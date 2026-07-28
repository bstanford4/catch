-- Privacy-safe Open to Catch matching and in-app Catch alerts.
--
-- An active Open listing is required before another member can see a compatible
-- person card. Saved availability may also power private notifications when a
-- matching Catch is posted, but it is never exposed as a searchable directory.

create table if not exists public.catch_match_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  catch_id uuid not null references public.catches(id) on delete cascade,
  match_reason text not null check (char_length(match_reason) between 1 and 300),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, catch_id)
);

create index if not exists catch_match_notifications_user_idx
on public.catch_match_notifications (user_id, read_at, created_at desc);

alter table public.catch_match_notifications enable row level security;
grant all privileges on public.catch_match_notifications to service_role;

create or replace function private.area_labels_match(first_area text, second_area text)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select lower(trim(split_part(coalesce(first_area, ''), ',', 1)))
       = lower(trim(split_part(coalesce(second_area, ''), ',', 1)))
     and trim(coalesce(first_area, '')) <> ''
     and trim(coalesce(second_area, '')) <> ''
$$;

create or replace function private.catch_broad_period(
  requested_starts_at timestamptz,
  requested_timezone text
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when extract(hour from requested_starts_at at time zone requested_timezone) < 12
      then 'morning'
    when extract(hour from requested_starts_at at time zone requested_timezone) < 17
      then 'afternoon'
    else 'evening'
  end
$$;

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
  availability_summary text;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if requested_hours not between 1 and 168 then
    raise exception 'Open to Catch can stay active from 1 hour to 7 days';
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

  select * into caller_profile
  from public.profiles
  where user_id = caller_id;

  select string_agg(
    distinct
      case availability.weekday
        when 0 then 'Sunday'
        when 1 then 'Monday'
        when 2 then 'Tuesday'
        when 3 then 'Wednesday'
        when 4 then 'Thursday'
        when 5 then 'Friday'
        else 'Saturday'
      end || ' ' || availability.broad_period || 's',
    ', '
    order by
      case availability.weekday
        when 0 then 'Sunday'
        when 1 then 'Monday'
        when 2 then 'Tuesday'
        when 3 then 'Wednesday'
        when 4 then 'Thursday'
        when 5 then 'Friday'
        else 'Saturday'
      end || ' ' || availability.broad_period || 's'
  )
  into availability_summary
  from public.availability_windows availability
  where availability.user_id = caller_id
    and availability.expires_at > now();

  update public.open_to_catch_listings
  set active = false
  where user_id = caller_id
    and active;

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
    availability_summary,
    true,
    now() + make_interval(hours => requested_hours),
    true
  )
  returning id into listing_id;

  insert into public.open_to_catch_activities (
    listing_id,
    activity_type_id,
    subtype_ids
  )
  select
    listing_id,
    preferences.activity_type_id,
    preferences.subtype_ids
  from public.user_activity_preferences preferences
  where preferences.user_id = caller_id;

  return listing_id;
end
$$;

create or replace function private.close_open_to_catch()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  update public.open_to_catch_listings
  set active = false
  where user_id = auth.uid()
    and active;
end
$$;

create or replace function private.get_my_open_to_catch()
returns table (
  listing_id uuid,
  expires_at timestamptz,
  broad_availability text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    listings.id,
    listings.expires_at,
    listings.broad_availability
  from public.open_to_catch_listings listings
  where listings.user_id = auth.uid()
    and listings.active
    and listings.expires_at > now()
  order by listings.created_at desc
  limit 1
$$;

create or replace function private.list_compatible_open_people()
returns table (
  user_id uuid,
  first_name text,
  area_label text,
  activity_ids uuid[],
  activity_names text[],
  activity_slugs text[],
  activity_emojis text[],
  overlap_labels text[],
  listing_expires_at timestamptz
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
    from public.open_to_catch_listings
    where public.open_to_catch_listings.user_id = caller_id
      and active
      and expires_at > now()
  ) then
    raise exception 'Turn on Open to Catch before viewing compatible people';
  end if;

  return query
  with caller_listing as (
    select *
    from public.open_to_catch_listings
    where public.open_to_catch_listings.user_id = caller_id
      and active
      and expires_at > now()
    order by created_at desc
    limit 1
  )
  select
    candidate.user_id,
    candidate_profile.first_name,
    candidate_profile.area_label,
    matches.activity_ids,
    matches.activity_names,
    matches.activity_slugs,
    matches.activity_emojis,
    availability_matches.overlap_labels,
    candidate.expires_at
  from public.open_to_catch_listings candidate
  join public.profiles candidate_profile on candidate_profile.user_id = candidate.user_id
  cross join caller_listing own
  cross join lateral (
    select
      array_agg(activity.id order by activity.name) as activity_ids,
      array_agg(activity.name order by activity.name) as activity_names,
      array_agg(activity.slug order by activity.name) as activity_slugs,
      array_agg(activity.emoji order by activity.name) as activity_emojis
    from public.open_to_catch_activities own_activity
    join public.open_to_catch_activities candidate_activity
      on candidate_activity.activity_type_id = own_activity.activity_type_id
     and candidate_activity.listing_id = candidate.id
    join public.activity_types activity on activity.id = own_activity.activity_type_id
    where own_activity.listing_id = own.id
  ) matches
  cross join lateral (
    select array_agg(distinct
      case own_window.weekday
        when 0 then 'Sunday'
        when 1 then 'Monday'
        when 2 then 'Tuesday'
        when 3 then 'Wednesday'
        when 4 then 'Thursday'
        when 5 then 'Friday'
        else 'Saturday'
      end || ' ' || own_window.broad_period || 's'
    ) as overlap_labels
    from public.availability_windows own_window
    join public.availability_windows candidate_window
      on candidate_window.weekday = own_window.weekday
     and candidate_window.broad_period = own_window.broad_period
     and candidate_window.user_id = candidate.user_id
     and candidate_window.expires_at > now()
    where own_window.user_id = caller_id
      and own_window.expires_at > now()
  ) availability_matches
  where candidate.user_id <> caller_id
    and candidate.active
    and candidate.expires_at > now()
    and private.area_labels_match(own.area_label, candidate.area_label)
    and cardinality(matches.activity_ids) > 0
    and cardinality(availability_matches.overlap_labels) > 0
    and not private.users_blocked(caller_id, candidate.user_id)
  order by cardinality(matches.activity_ids) desc, candidate.created_at desc;
end
$$;

create or replace function private.queue_catch_matches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  catch_weekday integer;
  catch_period text;
  activity_name text;
begin
  delete from public.catch_match_notifications where catch_id = new.id;

  if new.visibility <> 'public'
     or new.status <> 'open'
     or new.starts_at <= now() then
    return new;
  end if;

  catch_weekday := extract(dow from new.starts_at at time zone new.timezone)::integer;
  catch_period := private.catch_broad_period(new.starts_at, new.timezone);
  select name into activity_name
  from public.activity_types
  where id = new.activity_type_id;

  insert into public.catch_match_notifications (
    user_id,
    catch_id,
    match_reason
  )
  select
    profile.user_id,
    new.id,
    activity_name || ' | '
      || case catch_weekday
        when 0 then 'Sunday'
        when 1 then 'Monday'
        when 2 then 'Tuesday'
        when 3 then 'Wednesday'
        when 4 then 'Thursday'
        when 5 then 'Friday'
        else 'Saturday'
      end || ' ' || catch_period || ' | ' || new.area_label
  from public.profiles profile
  where profile.user_id <> new.host_id
    and private.area_labels_match(profile.area_label, new.area_label)
    and not private.users_blocked(profile.user_id, new.host_id)
    and (
      new.minimum_age = 18
      or profile.age_21_affirmed_at is not null
    )
    and coalesce((
      select preferences.nearby_activity
      from public.notification_preferences preferences
      where preferences.user_id = profile.user_id
    ), true)
    and exists (
      select 1
      from public.user_activity_preferences activity_preference
      where activity_preference.user_id = profile.user_id
        and activity_preference.activity_type_id = new.activity_type_id
    )
    and exists (
      select 1
      from public.availability_windows availability
      where availability.user_id = profile.user_id
        and availability.weekday = catch_weekday
        and availability.broad_period = catch_period
        and availability.expires_at > now()
    )
  on conflict (user_id, catch_id) do update set
    match_reason = excluded.match_reason,
    read_at = null,
    created_at = now();

  return new;
end
$$;

drop trigger if exists queue_catch_matches_after_change on public.catches;
create trigger queue_catch_matches_after_change
after insert or update of activity_type_id, starts_at, timezone, area_label, minimum_age, visibility, status
on public.catches
for each row execute function private.queue_catch_matches();

create or replace function private.list_catch_match_notifications()
returns table (
  notification_id uuid,
  catch_id uuid,
  catch_title text,
  host_first_name text,
  activity_name text,
  activity_slug text,
  activity_emoji text,
  starts_at timestamptz,
  duration_minutes integer,
  area_label text,
  location_type text,
  match_reason text,
  read_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    notifications.id,
    catch.id,
    catch.title,
    host_profile.first_name,
    activity.name,
    activity.slug,
    activity.emoji,
    catch.starts_at,
    catch.duration_minutes,
    catch.area_label,
    coalesce(catch.metadata->>'location_type', 'catalog'),
    notifications.match_reason,
    notifications.read_at,
    notifications.created_at
  from public.catch_match_notifications notifications
  join public.catches catch on catch.id = notifications.catch_id
  join public.profiles host_profile on host_profile.user_id = catch.host_id
  join public.activity_types activity on activity.id = catch.activity_type_id
  where notifications.user_id = auth.uid()
    and catch.status = 'open'
    and catch.starts_at > now()
    and not private.users_blocked(catch.host_id, auth.uid())
  order by notifications.read_at nulls first, notifications.created_at desc
$$;

create or replace function private.mark_catch_match_notification_read(requested_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.catch_match_notifications
  set read_at = coalesce(read_at, now())
  where id = requested_notification_id
    and user_id = auth.uid();
  if not found then
    raise exception 'Match notification not found';
  end if;
end
$$;

-- Open-listing matches may send a proposal without first becoming Catch Mates.
create or replace function private.create_direct_catch_proposal(
  requested_recipient_id uuid,
  requested_activity_type_id uuid,
  requested_starts_at timestamptz,
  requested_duration_minutes integer,
  requested_area_label text,
  requested_venue_id uuid default null,
  requested_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  proposal_id uuid;
  matched_listing_id uuid;
  proposed_weekday integer;
  proposed_period text;
  caller_timezone text;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if private.users_blocked(caller_id, requested_recipient_id) then
    raise exception 'This Catch member is unavailable';
  end if;
  if requested_starts_at is null or requested_starts_at <= now() then
    raise exception 'Choose a future start time';
  end if;
  if requested_duration_minutes not between 15 and 480 then
    raise exception 'Duration must be between 15 and 480 minutes';
  end if;
  if requested_area_label is null or char_length(trim(requested_area_label)) not between 1 and 100 then
    raise exception 'Enter a broad meeting area';
  end if;
  if requested_message is not null and char_length(requested_message) > 500 then
    raise exception 'Proposal message must be 500 characters or fewer';
  end if;
  if not exists (
    select 1 from public.activity_types
    where id = requested_activity_type_id and active
  ) then
    raise exception 'Choose an available activity';
  end if;
  if requested_venue_id is not null and not exists (
    select 1 from public.venues
    where id = requested_venue_id and is_public
  ) then
    raise exception 'Choose an available public venue';
  end if;

  if not exists (
    select 1
    from public.catch_mates
    where user_id = caller_id
      and mate_id = requested_recipient_id
  ) then
    select timezone into caller_timezone
    from public.availability_windows
    where user_id = caller_id
      and expires_at > now()
    limit 1;
    caller_timezone := coalesce(caller_timezone, 'UTC');
    proposed_weekday :=
      extract(dow from requested_starts_at at time zone caller_timezone)::integer;
    proposed_period := private.catch_broad_period(requested_starts_at, caller_timezone);

    select recipient_listing.id
    into matched_listing_id
    from public.open_to_catch_listings sender_listing
    join public.open_to_catch_activities sender_activity
      on sender_activity.listing_id = sender_listing.id
     and sender_activity.activity_type_id = requested_activity_type_id
    join public.open_to_catch_listings recipient_listing
      on recipient_listing.user_id = requested_recipient_id
     and recipient_listing.active
     and recipient_listing.expires_at > now()
    join public.open_to_catch_activities recipient_activity
      on recipient_activity.listing_id = recipient_listing.id
     and recipient_activity.activity_type_id = requested_activity_type_id
    where sender_listing.user_id = caller_id
      and sender_listing.active
      and sender_listing.expires_at > now()
      and private.area_labels_match(sender_listing.area_label, recipient_listing.area_label)
      and private.area_labels_match(recipient_listing.area_label, requested_area_label)
      and exists (
        select 1
        from public.availability_windows recipient_window
        where recipient_window.user_id = requested_recipient_id
          and recipient_window.weekday = proposed_weekday
          and recipient_window.broad_period = proposed_period
          and recipient_window.expires_at > now()
      )
    order by recipient_listing.created_at desc
    limit 1;

    if matched_listing_id is null then
      raise exception 'This person is no longer compatible or Open to Catch';
    end if;
  end if;

  insert into public.catch_proposals (
    sender_id,
    recipient_id,
    open_listing_id,
    status,
    current_revision,
    expires_at
  )
  values (
    caller_id,
    requested_recipient_id,
    matched_listing_id,
    'pending',
    1,
    least(requested_starts_at, now() + interval '7 days')
  )
  returning id into proposal_id;

  insert into public.proposal_revisions (
    proposal_id,
    revision,
    proposed_by,
    activity_type_id,
    starts_at,
    duration_minutes,
    area_label,
    venue_id,
    message
  )
  values (
    proposal_id,
    1,
    caller_id,
    requested_activity_type_id,
    requested_starts_at,
    requested_duration_minutes,
    trim(requested_area_label),
    requested_venue_id,
    nullif(trim(coalesce(requested_message, '')), '')
  );

  return proposal_id;
end
$$;

create or replace function public.publish_open_to_catch(requested_hours integer default 48)
returns uuid language sql security invoker set search_path = ''
as $$ select private.publish_open_to_catch(requested_hours) $$;

create or replace function public.close_open_to_catch()
returns void language sql security invoker set search_path = ''
as $$ select private.close_open_to_catch() $$;

create or replace function public.get_my_open_to_catch()
returns table (listing_id uuid, expires_at timestamptz, broad_availability text)
language sql security invoker set search_path = ''
as $$ select * from private.get_my_open_to_catch() $$;

create or replace function public.list_compatible_open_people()
returns table (
  user_id uuid,
  first_name text,
  area_label text,
  activity_ids uuid[],
  activity_names text[],
  activity_slugs text[],
  activity_emojis text[],
  overlap_labels text[],
  listing_expires_at timestamptz
)
language sql security invoker set search_path = ''
as $$ select * from private.list_compatible_open_people() $$;

create or replace function public.list_catch_match_notifications()
returns table (
  notification_id uuid,
  catch_id uuid,
  catch_title text,
  host_first_name text,
  activity_name text,
  activity_slug text,
  activity_emoji text,
  starts_at timestamptz,
  duration_minutes integer,
  area_label text,
  location_type text,
  match_reason text,
  read_at timestamptz,
  created_at timestamptz
)
language sql security invoker set search_path = ''
as $$ select * from private.list_catch_match_notifications() $$;

create or replace function public.mark_catch_match_notification_read(
  requested_notification_id uuid
)
returns void language sql security invoker set search_path = ''
as $$ select private.mark_catch_match_notification_read(requested_notification_id) $$;

revoke all on function private.area_labels_match(text, text) from public, anon, authenticated;
revoke all on function private.catch_broad_period(timestamptz, text) from public, anon, authenticated;
revoke all on function private.queue_catch_matches() from public, anon, authenticated;
revoke all on function private.publish_open_to_catch(integer) from public, anon;
revoke all on function private.close_open_to_catch() from public, anon;
revoke all on function private.get_my_open_to_catch() from public, anon;
revoke all on function private.list_compatible_open_people() from public, anon;
revoke all on function private.list_catch_match_notifications() from public, anon;
revoke all on function private.mark_catch_match_notification_read(uuid) from public, anon;

grant execute on function private.publish_open_to_catch(integer) to authenticated;
grant execute on function private.close_open_to_catch() to authenticated;
grant execute on function private.get_my_open_to_catch() to authenticated;
grant execute on function private.list_compatible_open_people() to authenticated;
grant execute on function private.list_catch_match_notifications() to authenticated;
grant execute on function private.mark_catch_match_notification_read(uuid) to authenticated;

revoke all on function public.publish_open_to_catch(integer) from public, anon;
revoke all on function public.close_open_to_catch() from public, anon;
revoke all on function public.get_my_open_to_catch() from public, anon;
revoke all on function public.list_compatible_open_people() from public, anon;
revoke all on function public.list_catch_match_notifications() from public, anon;
revoke all on function public.mark_catch_match_notification_read(uuid) from public, anon;

grant execute on function public.publish_open_to_catch(integer) to authenticated;
grant execute on function public.close_open_to_catch() to authenticated;
grant execute on function public.get_my_open_to_catch() to authenticated;
grant execute on function public.list_compatible_open_people() to authenticated;
grant execute on function public.list_catch_match_notifications() to authenticated;
grant execute on function public.mark_catch_match_notification_read(uuid) to authenticated;
