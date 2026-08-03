-- Unified completed-Catch history for hosts and approved participants.
-- Media remains stored once in catch_media; this query returns only album
-- summaries and private photo preview paths authorized for the current crew.

create or replace function private.list_my_catch_history(
  requested_limit integer default 50,
  requested_offset integer default 0
)
returns table (
  catch_id uuid,
  title text,
  starts_at timestamptz,
  duration_minutes integer,
  member_role text,
  location_label text,
  activity_name text,
  activity_slug text,
  activity_emoji text,
  participant_names text[],
  photo_count bigint,
  video_count bigint,
  preview_paths text[]
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

  return query
  select
    target.id,
    target.title,
    target.starts_at,
    target.duration_minutes,
    case when target.host_id = caller_id then 'host' else 'participant' end,
    case coalesce(target.metadata ->> 'location_type', 'catalog')
      when 'catalog' then coalesce(venue.name, target.area_label)
      when 'custom_public' then coalesce(
        nullif(target.metadata ->> 'custom_venue_name', ''),
        target.area_label
      )
      when 'private' then 'Private meetup · ' || target.area_label
      else 'Location decided later · ' || target.area_label
    end,
    coalesce(nullif(target.metadata ->> 'custom_activity_name', ''), activity.name),
    activity.slug,
    activity.emoji,
    coalesce(crew.names, array[]::text[]),
    media.photo_count,
    media.video_count,
    media.preview_paths
  from public.catches target
  join public.activity_types activity on activity.id = target.activity_type_id
  left join public.venues venue on venue.id = target.venue_id
  cross join lateral (
    select
      count(*) filter (where memory.media_type = 'photo') as photo_count,
      count(*) filter (where memory.media_type = 'video') as video_count,
      array(
        select preview.storage_path
        from public.catch_media preview
        where preview.catch_id = target.id
          and preview.media_type = 'photo'
        order by preview.created_at desc
        limit 3
      ) as preview_paths
    from public.catch_media memory
    where memory.catch_id = target.id
  ) media
  left join lateral (
    select array_agg(member.display_name order by member.is_caller desc, member.is_host desc, member.display_name) as names
    from (
      select
        host_profile.user_id,
        private.member_display_name(host_profile.first_name, host_profile.last_initial) as display_name,
        host_profile.user_id = caller_id as is_caller,
        true as is_host
      from public.profiles host_profile
      where host_profile.user_id = target.host_id

      union all

      select
        participant_profile.user_id,
        private.member_display_name(
          participant_profile.first_name,
          participant_profile.last_initial
        ),
        participant_profile.user_id = caller_id,
        false
      from public.catch_participants participant
      join public.profiles participant_profile
        on participant_profile.user_id = participant.user_id
      where participant.catch_id = target.id
        and participant.status in ('approved', 'attended')
        and participant.user_id <> target.host_id
    ) member
    where member.user_id = caller_id
      or not exists (
        select 1
        from public.blocks block
        where (block.blocker_id = caller_id and block.blocked_id = member.user_id)
           or (block.blocker_id = member.user_id and block.blocked_id = caller_id)
      )
  ) crew on true
  where target.status = 'completed'
    and (
      target.host_id = caller_id
      or exists (
        select 1
        from public.catch_participants membership
        where membership.catch_id = target.id
          and membership.user_id = caller_id
          and membership.status in ('approved', 'attended')
      )
    )
  order by target.starts_at desc
  limit least(greatest(coalesce(requested_limit, 50), 1), 100)
  offset greatest(coalesce(requested_offset, 0), 0);
end;
$$;

create or replace function public.list_my_catch_history(
  requested_limit integer default 50,
  requested_offset integer default 0
)
returns table (
  catch_id uuid,
  title text,
  starts_at timestamptz,
  duration_minutes integer,
  member_role text,
  location_label text,
  activity_name text,
  activity_slug text,
  activity_emoji text,
  participant_names text[],
  photo_count bigint,
  video_count bigint,
  preview_paths text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.list_my_catch_history(requested_limit, requested_offset);
$$;

revoke all on function public.list_my_catch_history(integer, integer)
from public, anon;
grant execute on function public.list_my_catch_history(integer, integer)
to authenticated;

comment on function public.list_my_catch_history(integer, integer) is
'Completed Catches hosted or joined by the caller, with crew-safe album summaries and no duplicated media.';
