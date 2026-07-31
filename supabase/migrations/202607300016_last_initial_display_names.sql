-- Optional last initials provide enough distinction without collecting or
-- exposing full last names. Existing RPC field names stay unchanged for client
-- compatibility, but their name values use the centralized display formatter.

alter table public.profiles
add column if not exists last_initial text
check (
  last_initial is null
  or (
    char_length(last_initial) = 1
    and last_initial ~ '^[[:alpha:]]$'
    and last_initial = upper(last_initial)
  )
);

create or replace function private.member_display_name(
  requested_first_name text,
  requested_last_initial text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(requested_first_name)
    || case
      when nullif(trim(requested_last_initial), '') is null then ''
      else ' ' || upper(left(trim(requested_last_initial), 1)) || '.'
    end
$$;

create or replace function private.update_my_profile(
  requested_first_name text,
  requested_last_initial text,
  requested_bio text,
  requested_activity_slugs text[],
  requested_photo_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_name text := trim(requested_first_name);
  normalized_initial text := nullif(upper(trim(requested_last_initial)), '');
  normalized_bio text := nullif(trim(requested_bio), '');
  display_name text;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if char_length(normalized_name) not between 1 and 60 then
    raise exception 'First name must be between 1 and 60 characters';
  end if;
  if normalized_initial is not null
    and (
      char_length(normalized_initial) <> 1
      or normalized_initial !~ '^[[:alpha:]]$'
    ) then
    raise exception 'Last initial must be one letter';
  end if;
  if normalized_bio is not null and char_length(normalized_bio) > 500 then
    raise exception 'Bio must be 500 characters or fewer';
  end if;
  if coalesce(cardinality(requested_activity_slugs), 0) = 0 then
    raise exception 'Choose at least one activity';
  end if;
  if (
    select count(distinct activity.slug)
    from public.activity_types activity
    where activity.slug = any(requested_activity_slugs)
      and activity.active
  ) <> cardinality(requested_activity_slugs) then
    raise exception 'One or more activities are invalid';
  end if;
  if requested_photo_path is not null
    and split_part(requested_photo_path, '/', 1) <> caller_id::text then
    raise exception 'Profile photo path must belong to the signed-in member';
  end if;

  update public.profiles
  set
    first_name = normalized_name,
    last_initial = normalized_initial,
    bio = normalized_bio,
    photo_path = requested_photo_path,
    updated_at = now()
  where user_id = caller_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  delete from public.user_activity_preferences
  where user_id = caller_id;

  insert into public.user_activity_preferences (user_id, activity_type_id)
  select caller_id, activity.id
  from public.activity_types activity
  where activity.slug = any(requested_activity_slugs)
    and activity.active;

  display_name := private.member_display_name(normalized_name, normalized_initial);
  update public.catches
  set metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{host_first_name}',
    to_jsonb(display_name),
    true
  )
  where host_id = caller_id;
end
$$;

create or replace function public.update_my_profile(
  requested_first_name text,
  requested_last_initial text,
  requested_bio text,
  requested_activity_slugs text[],
  requested_photo_path text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.update_my_profile(
    requested_first_name,
    requested_last_initial,
    requested_bio,
    requested_activity_slugs,
    requested_photo_path
  )
$$;

revoke all on function private.update_my_profile(text, text, text, text[], text)
from public, anon;
grant execute on function private.update_my_profile(text, text, text, text[], text)
to authenticated;
revoke all on function public.update_my_profile(text, text, text, text[], text)
from public, anon;
grant execute on function public.update_my_profile(text, text, text, text[], text)
to authenticated;

create or replace function private.list_host_join_requests(requested_catch_id uuid)
returns table (
  id uuid,
  requester_id uuid,
  requester_first_name text,
  message text,
  status public.participant_status,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if not exists (
    select 1
    from public.catches
    where public.catches.id = requested_catch_id
      and host_id = caller_id
  ) then
    raise exception 'Only the Catch host can view these requests';
  end if;

  return query
  select
    requests.id,
    requests.requester_id,
    private.member_display_name(profiles.first_name, profiles.last_initial),
    requests.message,
    requests.status,
    requests.created_at
  from public.join_requests requests
  join public.profiles profiles on profiles.user_id = requests.requester_id
  where requests.catch_id = requested_catch_id
  order by requests.created_at desc;
end
$$;

create or replace function private.list_catch_mates()
returns table (
  mate_id uuid,
  first_name text,
  area_label text,
  source text,
  saved_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    mates.mate_id,
    private.member_display_name(profiles.first_name, profiles.last_initial),
    profiles.area_label,
    mates.source,
    mates.created_at
  from public.catch_mates mates
  join public.profiles profiles on profiles.user_id = mates.mate_id
  where mates.user_id = auth.uid()
    and not private.users_blocked(mates.user_id, mates.mate_id)
  order by mates.created_at desc
$$;

create or replace function private.list_direct_catch_proposals()
returns table (
  proposal_id uuid,
  direction text,
  other_user_id uuid,
  other_first_name text,
  status public.proposal_status,
  activity_type_id uuid,
  activity_name text,
  activity_slug text,
  activity_emoji text,
  starts_at timestamptz,
  duration_minutes integer,
  area_label text,
  venue_id uuid,
  venue_name text,
  message text,
  accepted_catch_id uuid,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    proposals.id,
    case when proposals.sender_id = auth.uid() then 'sent' else 'received' end,
    case when proposals.sender_id = auth.uid() then proposals.recipient_id else proposals.sender_id end,
    private.member_display_name(other_profile.first_name, other_profile.last_initial),
    proposals.status,
    revision.activity_type_id,
    activity.name,
    activity.slug,
    activity.emoji,
    revision.starts_at,
    revision.duration_minutes,
    revision.area_label,
    revision.venue_id,
    venue.name,
    revision.message,
    proposals.accepted_catch_id,
    proposals.created_at
  from public.catch_proposals proposals
  join public.proposal_revisions revision
    on revision.proposal_id = proposals.id
   and revision.revision = proposals.current_revision
  join public.activity_types activity on activity.id = revision.activity_type_id
  join public.profiles other_profile
    on other_profile.user_id = case
      when proposals.sender_id = auth.uid() then proposals.recipient_id
      else proposals.sender_id
    end
  left join public.venues venue on venue.id = revision.venue_id
  where auth.uid() in (proposals.sender_id, proposals.recipient_id)
    and not private.users_blocked(proposals.sender_id, proposals.recipient_id)
  order by proposals.created_at desc
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
    private.member_display_name(
      candidate_profile.first_name,
      candidate_profile.last_initial
    ),
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
    private.member_display_name(host_profile.first_name, host_profile.last_initial),
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
    private.member_display_name(profile.first_name, profile.last_initial),
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
    private.member_display_name(profile.first_name, profile.last_initial);
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
    private.member_display_name(profile.first_name, profile.last_initial),
    profile.bio,
    profile.area_label,
    exists (
      select 1
      from public.catch_mates mate
      where mate.user_id = caller_id
        and mate.mate_id = profile.user_id
    ),
    coalesce(profile_activities.names, '{}'::text[]),
    coalesce(profile_activities.slugs, '{}'::text[]),
    coalesce(profile_activities.emojis, '{}'::text[]),
    coalesce(profile_availability.labels, '{}'::text[]),
    coalesce(profile_equipment.labels, '{}'::text[]),
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
  ) profile_activities on true
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
  ) profile_availability on true
  left join lateral (
    select array_agg(
      item.name
        || case when item.quantity > 1 then ' (' || item.quantity::text || ')' else '' end
      order by item.name
    ) as labels
    from public.equipment_items item
    where item.owner_id = profile.user_id
      and item.can_share
  ) profile_equipment on true
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

create or replace function private.list_message_threads()
returns table (
  thread_type text,
  thread_id uuid,
  title text,
  context_label text,
  activity_name text,
  activity_slug text,
  activity_emoji text,
  other_first_name text,
  status text,
  starts_at timestamptz,
  latest_body text,
  latest_at timestamptz,
  unread_count bigint,
  can_send boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with accessible_catches as (
    select
      'catch'::text as thread_type,
      catch.id as thread_id,
      catch.title,
      'Catch · ' || activity.name as context_label,
      activity.name as activity_name,
      activity.slug as activity_slug,
      activity.emoji as activity_emoji,
      coalesce(other_people.names, 'Catch crew') as other_first_name,
      catch.status::text as status,
      catch.starts_at,
      coalesce(latest.body, 'Start the conversation.') as latest_body,
      coalesce(latest.created_at, catch.updated_at, catch.created_at) as latest_at,
      coalesce(unread.total, 0)::bigint as unread_count,
      catch.status in ('open', 'full', 'confirmed') as can_send
    from public.catches catch
    join public.activity_types activity on activity.id = catch.activity_type_id
    left join lateral (
      select string_agg(person.first_name, ', ' order by person.first_name) as names
      from (
        select private.member_display_name(
          host_profile.first_name,
          host_profile.last_initial
        ) as first_name
        from public.profiles host_profile
        where host_profile.user_id = catch.host_id
          and catch.host_id <> auth.uid()
        union
        select private.member_display_name(
          participant_profile.first_name,
          participant_profile.last_initial
        )
        from public.catch_participants participant
        join public.profiles participant_profile
          on participant_profile.user_id = participant.user_id
        where participant.catch_id = catch.id
          and participant.user_id <> auth.uid()
          and participant.status in ('approved', 'attended')
      ) person
    ) other_people on true
    left join lateral (
      select message.body, message.created_at
      from public.catch_messages message
      where message.catch_id = catch.id
      order by message.created_at desc
      limit 1
    ) latest on true
    left join public.message_thread_reads read_state
      on read_state.user_id = auth.uid()
     and read_state.catch_id = catch.id
    left join lateral (
      select count(*) as total
      from public.catch_messages message
      where message.catch_id = catch.id
        and message.sender_id is distinct from auth.uid()
        and message.created_at > coalesce(read_state.last_read_at, '-infinity'::timestamptz)
    ) unread on true
    where private.can_access_message_context(auth.uid(), catch.id, null)
  ),
  accessible_proposals as (
    select
      'proposal'::text as thread_type,
      proposal.id as thread_id,
      private.member_display_name(
        other_profile.first_name,
        other_profile.last_initial
      ) as title,
      'Proposal · ' || activity.name as context_label,
      activity.name as activity_name,
      activity.slug as activity_slug,
      activity.emoji as activity_emoji,
      private.member_display_name(
        other_profile.first_name,
        other_profile.last_initial
      ) as other_first_name,
      proposal.status::text as status,
      revision.starts_at,
      coalesce(latest.body, revision.message, 'Catch proposal ready.') as latest_body,
      coalesce(latest.created_at, proposal.updated_at, proposal.created_at) as latest_at,
      coalesce(unread.total, 0)::bigint as unread_count,
      proposal.status in ('pending', 'countered') and proposal.expires_at > now() as can_send
    from public.catch_proposals proposal
    join public.proposal_revisions revision
      on revision.proposal_id = proposal.id
     and revision.revision = proposal.current_revision
    join public.activity_types activity on activity.id = revision.activity_type_id
    join public.profiles other_profile
      on other_profile.user_id = case
        when proposal.sender_id = auth.uid() then proposal.recipient_id
        else proposal.sender_id
      end
    left join lateral (
      select message.body, message.created_at
      from public.catch_messages message
      where message.proposal_id = proposal.id
      order by message.created_at desc
      limit 1
    ) latest on true
    left join public.message_thread_reads read_state
      on read_state.user_id = auth.uid()
     and read_state.proposal_id = proposal.id
    left join lateral (
      select count(*) as total
      from public.catch_messages message
      where message.proposal_id = proposal.id
        and message.sender_id is distinct from auth.uid()
        and message.created_at > coalesce(read_state.last_read_at, '-infinity'::timestamptz)
    ) unread on true
    where private.can_access_message_context(auth.uid(), null, proposal.id)
      and (proposal.status <> 'accepted' or proposal.accepted_catch_id is null)
  )
  select * from accessible_catches
  union all
  select * from accessible_proposals
  order by latest_at desc
$$;

create or replace function private.list_thread_messages(
  requested_thread_type text,
  requested_thread_id uuid
)
returns table (
  message_id uuid,
  sender_id uuid,
  sender_first_name text,
  kind text,
  body text,
  created_at timestamptz,
  is_own boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  requested_catch_id uuid;
  requested_proposal_id uuid;
begin
  if requested_thread_type = 'catch' then
    requested_catch_id := requested_thread_id;
  elsif requested_thread_type = 'proposal' then
    requested_proposal_id := requested_thread_id;
  else
    raise exception 'Unknown message thread';
  end if;

  if not private.can_access_message_context(
    auth.uid(),
    requested_catch_id,
    requested_proposal_id
  ) then
    raise exception 'Message thread not found';
  end if;

  return query
  select
    message.id,
    message.sender_id,
    case
      when message.kind = 'system' then 'Catch crew'
      else coalesce(
        private.member_display_name(sender.first_name, sender.last_initial),
        'Catch mate'
      )
    end,
    message.kind,
    message.body,
    message.created_at,
    message.sender_id = auth.uid()
  from public.catch_messages message
  left join public.profiles sender on sender.user_id = message.sender_id
  where
    (requested_catch_id is not null and message.catch_id = requested_catch_id)
    or
    (requested_proposal_id is not null and message.proposal_id = requested_proposal_id)
  order by message.created_at;
end
$$;

create or replace function private.list_direct_message_threads()
returns table (
  thread_id uuid,
  other_user_id uuid,
  other_first_name text,
  latest_body text,
  latest_at timestamptz,
  unread_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    thread.id,
    other_profile.user_id,
    private.member_display_name(
      other_profile.first_name,
      other_profile.last_initial
    ),
    coalesce(latest.body, 'Start a private conversation.'),
    coalesce(latest.created_at, thread.updated_at, thread.created_at),
    coalesce(unread.total, 0)::bigint
  from public.direct_message_threads thread
  join public.profiles other_profile
    on other_profile.user_id = case
      when thread.user_one_id = auth.uid() then thread.user_two_id
      else thread.user_one_id
    end
  left join lateral (
    select message.body, message.created_at
    from public.direct_messages message
    where message.thread_id = thread.id
    order by message.created_at desc
    limit 1
  ) latest on true
  left join public.direct_message_thread_reads read_state
    on read_state.thread_id = thread.id
   and read_state.user_id = auth.uid()
  left join lateral (
    select count(*) as total
    from public.direct_messages message
    where message.thread_id = thread.id
      and message.sender_id <> auth.uid()
      and message.created_at > coalesce(
        read_state.last_read_at,
        '-infinity'::timestamptz
      )
  ) unread on true
  where auth.uid() in (thread.user_one_id, thread.user_two_id)
    and private.can_direct_message(thread.user_one_id, thread.user_two_id)
  order by coalesce(latest.created_at, thread.updated_at, thread.created_at) desc
$$;

create or replace function private.list_direct_messages(requested_thread_id uuid)
returns table (
  message_id uuid,
  sender_id uuid,
  sender_first_name text,
  kind text,
  body text,
  created_at timestamptz,
  is_own boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  thread_row public.direct_message_threads%rowtype;
begin
  select *
  into thread_row
  from public.direct_message_threads
  where id = requested_thread_id
    and caller_id in (user_one_id, user_two_id);

  if not found
    or not private.can_direct_message(thread_row.user_one_id, thread_row.user_two_id)
  then
    raise exception 'Direct message thread not found';
  end if;

  return query
  select
    message.id,
    message.sender_id,
    coalesce(
      private.member_display_name(sender.first_name, sender.last_initial),
      'Catch mate'
    ),
    'user'::text,
    message.body,
    message.created_at,
    message.sender_id = caller_id
  from public.direct_messages message
  join public.profiles sender on sender.user_id = message.sender_id
  where message.thread_id = requested_thread_id
  order by message.created_at;
end
$$;

create or replace function private.push_proposal_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  proposal public.catch_proposals%rowtype;
  target_id uuid;
  proposer_name text;
  activity_name text;
begin
  select * into proposal
  from public.catch_proposals
  where id = new.proposal_id;

  target_id := case
    when new.proposed_by = proposal.sender_id then proposal.recipient_id
    else proposal.sender_id
  end;
  select private.member_display_name(first_name, last_initial)
  into proposer_name
  from public.profiles
  where user_id = new.proposed_by;
  select name into activity_name
  from public.activity_types
  where id = new.activity_type_id;

  perform private.queue_push_notification(
    target_id,
    'proposals',
    case when new.revision = 1 then 'New Catch proposal' else 'Counterproposal received' end,
    coalesce(proposer_name, 'A Catch mate') || ' proposed a '
      || coalesce(activity_name, 'new') || ' Catch.',
    jsonb_build_object('path', '/proposals', 'proposalId', new.proposal_id)
  );
  return new;
end
$$;

create or replace function private.push_proposal_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  actor_name text;
  destination text := '/proposals';
begin
  if old.status is not distinct from new.status
    or new.status not in ('accepted', 'declined', 'withdrawn')
  then
    return new;
  end if;

  if new.status = 'withdrawn' then
    target_id := new.recipient_id;
    select private.member_display_name(first_name, last_initial)
    into actor_name
    from public.profiles
    where user_id = new.sender_id;
  else
    target_id := new.sender_id;
    select private.member_display_name(first_name, last_initial)
    into actor_name
    from public.profiles
    where user_id = new.recipient_id;
  end if;
  if new.status = 'accepted' and new.accepted_catch_id is not null then
    destination := '/catch/' || new.accepted_catch_id::text;
  end if;

  perform private.queue_push_notification(
    target_id,
    'proposals',
    case new.status
      when 'accepted' then 'Proposal accepted'
      when 'declined' then 'Proposal declined'
      else 'Proposal withdrawn'
    end,
    coalesce(actor_name, 'Your Catch mate') || ' updated your Catch proposal.',
    jsonb_build_object('path', destination, 'proposalId', new.id)
  );
  return new;
end
$$;

create or replace function private.push_join_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  host_id uuid;
  catch_title text;
  requester_name text;
begin
  if new.status <> 'requested' then
    return new;
  end if;
  select catch.host_id, catch.title
  into host_id, catch_title
  from public.catches catch
  where catch.id = new.catch_id;
  select private.member_display_name(first_name, last_initial)
  into requester_name
  from public.profiles
  where user_id = new.requester_id;

  perform private.queue_push_notification(
    host_id,
    'join_requests',
    'New join request',
    coalesce(requester_name, 'Someone nearby') || ' asked to join '
      || coalesce(catch_title, 'your Catch') || '.',
    jsonb_build_object(
      'path', '/catch-requests/' || new.catch_id::text,
      'catchId', new.catch_id
    )
  );
  return new;
end
$$;

create or replace function private.push_direct_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_id uuid;
  sender_name text;
begin
  select
    case
      when thread.user_one_id = new.sender_id then thread.user_two_id
      else thread.user_one_id
    end
  into recipient_id
  from public.direct_message_threads thread
  where thread.id = new.thread_id;

  select private.member_display_name(first_name, last_initial)
  into sender_name
  from public.profiles
  where user_id = new.sender_id;

  perform private.queue_push_notification(
    recipient_id,
    'messages',
    'New message from ' || coalesce(sender_name, 'a Catch Mate'),
    new.body,
    jsonb_build_object(
      'path', '/message/direct/' || new.thread_id::text,
      'threadType', 'direct',
      'threadId', new.thread_id
    )
  );
  return new;
end
$$;
