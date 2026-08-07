-- Let connected members see a photo only when its exact equipment item is
-- explicitly marked shareable. Unshared gear and unreferenced objects remain
-- owner-only.

create or replace function private.can_read_shareable_equipment_photo(
  requested_object_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  owner_segment text := split_part(requested_object_name, '/', 1);
  owner_id uuid;
begin
  if caller_id is null then
    return false;
  end if;
  if owner_segment
    !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  owner_id := owner_segment::uuid;
  if owner_id = caller_id then
    return true;
  end if;

  return exists (
    select 1
    from public.equipment_photos photo
    join public.equipment_items item on item.id = photo.equipment_item_id
    where photo.storage_path = requested_object_name
      and item.owner_id = owner_id
      and item.can_share
      and private.can_direct_message(caller_id, owner_id)
  );
end
$$;

drop policy if exists "connected members can read shareable equipment photos"
on storage.objects;
create policy "connected members can read shareable equipment photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'equipment-photos'
  and private.can_read_shareable_equipment_photo(name)
);

revoke all on function private.can_read_shareable_equipment_photo(text)
from public, anon;
grant execute on function private.can_read_shareable_equipment_photo(text)
to authenticated;

create or replace function private.list_participant_shareable_equipment(
  requested_user_id uuid
)
returns table (
  equipment_id uuid,
  equipment_name text,
  condition text,
  quantity integer,
  activity_name text,
  activity_slug text,
  activity_emoji text,
  photo_path text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if not private.can_direct_message(caller_id, requested_user_id) then
    raise exception 'Participant profile not found';
  end if;

  return query
  select
    item.id,
    item.name,
    item.condition,
    item.quantity,
    activity.name,
    activity.slug,
    activity.emoji,
    photo.storage_path
  from public.equipment_items item
  join public.activity_types activity on activity.id = item.activity_type_id
  left join lateral (
    select saved_photo.storage_path
    from public.equipment_photos saved_photo
    where saved_photo.equipment_item_id = item.id
    order by saved_photo.sort_order, saved_photo.id
    limit 1
  ) photo on true
  where item.owner_id = requested_user_id
    and item.can_share
  order by activity.sort_order, item.name;
end
$$;

create or replace function public.list_participant_shareable_equipment(
  requested_user_id uuid
)
returns table (
  equipment_id uuid,
  equipment_name text,
  condition text,
  quantity integer,
  activity_name text,
  activity_slug text,
  activity_emoji text,
  photo_path text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.list_participant_shareable_equipment(requested_user_id);
$$;

revoke all on function private.list_participant_shareable_equipment(uuid)
from public, anon;
grant execute on function private.list_participant_shareable_equipment(uuid)
to authenticated;

revoke all on function public.list_participant_shareable_equipment(uuid)
from public, anon;
grant execute on function public.list_participant_shareable_equipment(uuid)
to authenticated;

comment on function public.list_participant_shareable_equipment(uuid) is
'Returns explicitly shareable equipment and its authorized photo path to connected members only.';

-- Connected members may see a privacy-thresholded aggregate Catch Card. Raw
-- ratings and notes never leave the ratings table, and fewer than three
-- distinct reviewers produces only a "building" state.
create or replace function private.get_participant_scouting_report(
  requested_user_id uuid
)
returns table (
  user_id uuid,
  catch_card_visible boolean,
  completed_catch_count integer,
  reviewer_count integer,
  reliable_percent integer,
  would_again_percent integer,
  top_traits text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if not private.can_direct_message(caller_id, requested_user_id) then
    raise exception 'Participant profile not found';
  end if;

  return query
  with subject_profile as (
    select profile.user_id, profile.catch_card_visible
    from public.profiles profile
    where profile.user_id = requested_user_id
  ), completed as (
    select count(*)::integer as catch_count
    from public.catches target
    where target.status = 'completed'
      and (
        target.host_id = requested_user_id
        or exists (
          select 1
          from public.catch_participants membership
          where membership.catch_id = target.id
            and membership.user_id = requested_user_id
            and membership.status in ('approved', 'attended')
        )
      )
  ), received as (
    select review.*
    from public.ratings review
    join public.catches target on target.id = review.catch_id
    where review.subject_type = 'user'
      and review.subject_id = requested_user_id
      and review.aspect = 'catch_mate'
      and target.status = 'completed'
  ), stats as (
    select
      count(distinct received.rater_id)::integer as reviewers,
      count(received.id)::integer as ratings,
      count(received.id) filter (where 'reliable' = any(received.traits))::integer as reliable_ratings,
      count(received.id) filter (where received.would_catch_again)::integer as again_ratings,
      count(received.id) filter (where received.would_catch_again is not null)::integer as again_answers
    from received
  ), trait_counts as (
    select trait, count(*) as trait_count
    from received review
    cross join lateral unnest(review.traits) trait
    group by trait
  )
  select
    subject_profile.user_id,
    subject_profile.catch_card_visible,
    completed.catch_count,
    stats.reviewers,
    case
      when subject_profile.catch_card_visible and stats.reviewers >= 3 and stats.ratings > 0
        then round(100.0 * stats.reliable_ratings / stats.ratings)::integer
      else 0
    end,
    case
      when subject_profile.catch_card_visible and stats.reviewers >= 3 and stats.again_answers > 0
        then round(100.0 * stats.again_ratings / stats.again_answers)::integer
      else 0
    end,
    case
      when subject_profile.catch_card_visible and stats.reviewers >= 3 then array(
        select trait_counts.trait
        from trait_counts
        order by trait_counts.trait_count desc, trait_counts.trait
        limit 3
      )
      else array[]::text[]
    end
  from subject_profile
  cross join completed
  cross join stats;
end
$$;

create or replace function public.get_participant_scouting_report(
  requested_user_id uuid
)
returns table (
  user_id uuid,
  catch_card_visible boolean,
  completed_catch_count integer,
  reviewer_count integer,
  reliable_percent integer,
  would_again_percent integer,
  top_traits text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_participant_scouting_report(requested_user_id);
$$;

revoke all on function private.get_participant_scouting_report(uuid)
from public, anon;
grant execute on function private.get_participant_scouting_report(uuid)
to authenticated;

revoke all on function public.get_participant_scouting_report(uuid)
from public, anon;
grant execute on function public.get_participant_scouting_report(uuid)
to authenticated;

comment on function public.get_participant_scouting_report(uuid) is
'Returns a connected member Catch Card; aggregate ratings unlock only after three distinct reviewers.';
