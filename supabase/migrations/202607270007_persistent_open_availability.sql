-- Persistent Open to Catch and recurring weekly availability.
--
-- The existing expires_at columns remain for backward compatibility, but
-- active recurring preferences use a far-future value and stay in effect until
-- the member changes, clears, or pauses them.

update public.availability_windows
set expires_at = '9999-12-31 23:59:59+00'::timestamptz
where expires_at > now();

update public.open_to_catch_listings
set expires_at = '9999-12-31 23:59:59+00'::timestamptz
where active
  and expires_at > now();

create or replace function private.sync_open_to_catch_listing(requested_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_profile public.profiles%rowtype;
  availability_summary text;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if not exists (
    select 1
    from public.open_to_catch_listings
    where id = requested_listing_id
      and user_id = caller_id
  ) then
    raise exception 'Open to Catch listing not found';
  end if;

  select *
  into caller_profile
  from public.profiles
  where user_id = caller_id;

  select string_agg(window_label, ', ' order by weekday, broad_period)
  into availability_summary
  from (
    select distinct
      availability.weekday,
      availability.broad_period,
      case availability.weekday
        when 0 then 'Sunday'
        when 1 then 'Monday'
        when 2 then 'Tuesday'
        when 3 then 'Wednesday'
        when 4 then 'Thursday'
        when 5 then 'Friday'
        else 'Saturday'
      end || ' ' || availability.broad_period || 's' as window_label
    from public.availability_windows availability
    where availability.user_id = caller_id
      and availability.expires_at > now()
  ) saved_windows;

  update public.open_to_catch_listings
  set
    area_label = caller_profile.area_label,
    discovery_location = caller_profile.coarse_location,
    radius_miles = caller_profile.preferred_radius_miles,
    broad_availability = availability_summary,
    expires_at = '9999-12-31 23:59:59+00'::timestamptz,
    active = true
  where id = requested_listing_id;

  delete from public.open_to_catch_activities
  where listing_id = requested_listing_id;

  insert into public.open_to_catch_activities (
    listing_id,
    activity_type_id,
    subtype_ids
  )
  select
    requested_listing_id,
    preferences.activity_type_id,
    preferences.subtype_ids
  from public.user_activity_preferences preferences
  where preferences.user_id = caller_id;
end
$$;

-- Keep the existing argument for backward compatibility with already-released
-- clients. Its value is intentionally ignored because the setting is persistent.
create or replace function private.publish_open_to_catch(requested_hours integer default 48)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_profile public.profiles%rowtype;
  listing_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if not exists (
    select 1
    from public.availability_windows
    where user_id = caller_id
      and expires_at > now()
  ) then
    raise exception 'Save at least one availability window first';
  end if;
  if not exists (
    select 1
    from public.user_activity_preferences
    where user_id = caller_id
  ) then
    raise exception 'Choose at least one activity first';
  end if;

  select *
  into caller_profile
  from public.profiles
  where user_id = caller_id;

  select id
  into listing_id
  from public.open_to_catch_listings
  where user_id = caller_id
    and active
  order by created_at desc
  limit 1;

  if listing_id is null then
    insert into public.open_to_catch_listings (
      user_id,
      area_label,
      discovery_location,
      radius_miles,
      broad_availability,
      public_spaces_only,
      expires_at,
      active
    )
    values (
      caller_id,
      caller_profile.area_label,
      caller_profile.coarse_location,
      caller_profile.preferred_radius_miles,
      'Saved weekly availability',
      true,
      '9999-12-31 23:59:59+00'::timestamptz,
      true
    )
    returning id into listing_id;
  end if;

  update public.open_to_catch_listings
  set active = false
  where user_id = caller_id
    and active
    and id <> listing_id;

  perform private.sync_open_to_catch_listing(listing_id);
  return listing_id;
end
$$;

create or replace function private.refresh_open_to_catch_if_active()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  listing_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select id
  into listing_id
  from public.open_to_catch_listings
  where user_id = caller_id
    and active
    and expires_at > now()
  order by created_at desc
  limit 1;

  if listing_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.availability_windows
    where user_id = caller_id
      and expires_at > now()
  ) or not exists (
    select 1
    from public.user_activity_preferences
    where user_id = caller_id
  ) then
    update public.open_to_catch_listings
    set active = false
    where id = listing_id;
    return;
  end if;

  perform private.sync_open_to_catch_listing(listing_id);
end
$$;

create or replace function public.refresh_open_to_catch_if_active()
returns void
language sql
security invoker
set search_path = ''
as $$ select private.refresh_open_to_catch_if_active() $$;

revoke all on function private.sync_open_to_catch_listing(uuid)
from public, anon, authenticated;
revoke all on function private.refresh_open_to_catch_if_active()
from public, anon;
grant execute on function private.refresh_open_to_catch_if_active()
to authenticated;

revoke all on function public.refresh_open_to_catch_if_active()
from public, anon;
grant execute on function public.refresh_open_to_catch_if_active()
to authenticated;
