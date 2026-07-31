-- Privacy-scoped participant profiles. Profiles are available only to Catch
-- Mates and people who have shared an approved Catch, and never expose email,
-- exact location, age details, or private equipment/photo data.

create or replace function private.list_catch_participant_profiles(
  requested_catch_id uuid
)
returns table (
  user_id uuid,
  first_name text,
  member_role text,
  member_status text,
  is_catch_mate boolean
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
  if not exists (
    select 1
    from public.catches catch
    where catch.id = requested_catch_id
      and (
        catch.host_id = caller_id
        or exists (
          select 1
          from public.catch_participants caller_membership
          where caller_membership.catch_id = catch.id
            and caller_membership.user_id = caller_id
            and caller_membership.status in ('approved', 'attended')
        )
      )
  ) then
    raise exception 'Catch crew is available only to approved members';
  end if;

  return query
  with crew as (
    select
      catch.host_id as crew_user_id,
      'host'::text as crew_role,
      'approved'::text as crew_status
    from public.catches catch
    where catch.id = requested_catch_id
    union all
    select
      participant.user_id,
      participant.role,
      participant.status::text
    from public.catch_participants participant
    where participant.catch_id = requested_catch_id
      and participant.status in ('approved', 'attended')
  )
  select
    profile.user_id,
    profile.first_name,
    crew.crew_role,
    crew.crew_status,
    exists (
      select 1
      from public.catch_mates mate
      where mate.user_id = caller_id
        and mate.mate_id = profile.user_id
    )
  from crew
  join public.profiles profile on profile.user_id = crew.crew_user_id
  where profile.user_id <> caller_id
    and not private.users_blocked(caller_id, profile.user_id)
  order by
    case when crew.crew_role = 'host' then 0 else 1 end,
    profile.first_name;
end
$$;

create or replace function private.get_participant_profile(requested_user_id uuid)
returns table (
  user_id uuid,
  first_name text,
  bio text,
  area_label text,
  is_catch_mate boolean,
  activity_names text[],
  activity_slugs text[],
  activity_emojis text[],
  availability_labels text[],
  shareable_equipment text[],
  catches_together bigint
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
    profile.user_id,
    profile.first_name,
    profile.bio,
    profile.area_label,
    exists (
      select 1
      from public.catch_mates mate
      where mate.user_id = caller_id
        and mate.mate_id = profile.user_id
    ),
    coalesce(activities.names, '{}'::text[]),
    coalesce(activities.slugs, '{}'::text[]),
    coalesce(activities.emojis, '{}'::text[]),
    coalesce(availability.labels, '{}'::text[]),
    coalesce(equipment.labels, '{}'::text[]),
    coalesce(shared.total, 0)::bigint
  from public.profiles profile
  left join lateral (
    select
      array_agg(activity.name order by activity.sort_order, activity.name) as names,
      array_agg(activity.slug order by activity.sort_order, activity.name) as slugs,
      array_agg(coalesce(activity.emoji, '') order by activity.sort_order, activity.name) as emojis
    from public.user_activity_preferences preference
    join public.activity_types activity on activity.id = preference.activity_type_id
    where preference.user_id = profile.user_id
      and activity.active
  ) activities on true
  left join lateral (
    select array_agg(
      saved_window.label
      order by saved_window.weekday, saved_window.period_order
    ) as labels
    from (
      select distinct
        availability.weekday,
        case availability.broad_period
          when 'morning' then 0
          when 'afternoon' then 1
          else 2
        end as period_order,
        case availability.weekday
          when 0 then 'Sunday'
          when 1 then 'Monday'
          when 2 then 'Tuesday'
          when 3 then 'Wednesday'
          when 4 then 'Thursday'
          when 5 then 'Friday'
          else 'Saturday'
        end || ' ' || availability.broad_period || 's' as label
      from public.availability_windows availability
      where availability.user_id = profile.user_id
        and availability.expires_at > now()
    ) saved_window
  ) availability on true
  left join lateral (
    select array_agg(
      item.name
        || case when item.quantity > 1 then ' (' || item.quantity::text || ')' else '' end
      order by item.name
    ) as labels
    from public.equipment_items item
    where item.owner_id = profile.user_id
      and item.can_share
  ) equipment on true
  left join lateral (
    select count(*) as total
    from public.catches shared_catch
    where shared_catch.status not in ('draft', 'canceled', 'disputed')
      and (
        shared_catch.host_id = caller_id
        or exists (
          select 1
          from public.catch_participants caller_participant
          where caller_participant.catch_id = shared_catch.id
            and caller_participant.user_id = caller_id
            and caller_participant.status in ('approved', 'attended')
        )
      )
      and (
        shared_catch.host_id = profile.user_id
        or exists (
          select 1
          from public.catch_participants profile_participant
          where profile_participant.catch_id = shared_catch.id
            and profile_participant.user_id = profile.user_id
            and profile_participant.status in ('approved', 'attended')
        )
      )
  ) shared on true
  where profile.user_id = requested_user_id;
end
$$;

create or replace function public.list_catch_participant_profiles(
  requested_catch_id uuid
)
returns table (
  user_id uuid,
  first_name text,
  member_role text,
  member_status text,
  is_catch_mate boolean
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.list_catch_participant_profiles(requested_catch_id) $$;

create or replace function public.get_participant_profile(requested_user_id uuid)
returns table (
  user_id uuid,
  first_name text,
  bio text,
  area_label text,
  is_catch_mate boolean,
  activity_names text[],
  activity_slugs text[],
  activity_emojis text[],
  availability_labels text[],
  shareable_equipment text[],
  catches_together bigint
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.get_participant_profile(requested_user_id) $$;

revoke all on function private.list_catch_participant_profiles(uuid)
from public, anon;
revoke all on function private.get_participant_profile(uuid)
from public, anon;
grant execute on function private.list_catch_participant_profiles(uuid)
to authenticated;
grant execute on function private.get_participant_profile(uuid)
to authenticated;

revoke all on function public.list_catch_participant_profiles(uuid)
from public, anon;
revoke all on function public.get_participant_profile(uuid)
from public, anon;
grant execute on function public.list_catch_participant_profiles(uuid)
to authenticated;
grant execute on function public.get_participant_profile(uuid)
to authenticated;
