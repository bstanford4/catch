-- Attendance confirmation for completed planned Catches and opt-in expanded
-- direct proposals. Raw attendance reports are private. One person's no-show
-- report never changes another member's public reputation.

alter table public.proposal_revisions
  add column if not exists allow_others_to_join boolean not null default false,
  add column if not exists maximum_participants integer not null default 2;

alter table public.proposal_revisions
  drop constraint if exists proposal_revisions_maximum_participants_check,
  add constraint proposal_revisions_maximum_participants_check
    check (maximum_participants between 2 and 12),
  drop constraint if exists proposal_revisions_open_shape_check,
  add constraint proposal_revisions_open_shape_check
    check (
      (allow_others_to_join and maximum_participants between 3 and 12)
      or (not allow_others_to_join and maximum_participants = 2)
    );

alter table public.catches
  add column if not exists attendance_required_at timestamptz;

create table if not exists public.catch_attendance_confirmations (
  catch_id uuid not null references public.catches(id) on delete cascade,
  confirmer_id uuid not null references public.profiles(user_id) on delete cascade,
  subject_id uuid not null references public.profiles(user_id) on delete cascade,
  attendance text not null check (attendance in ('attended', 'no_show')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (catch_id, confirmer_id, subject_id)
);

create index if not exists catch_attendance_subject_idx
on public.catch_attendance_confirmations (catch_id, subject_id, attendance);

alter table public.catch_attendance_confirmations enable row level security;
revoke all on public.catch_attendance_confirmations from public, anon, authenticated;
grant all privileges on public.catch_attendance_confirmations to service_role;

create or replace function private.is_original_catch_crew_member(
  requested_catch_id uuid,
  requested_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.catches target
    where target.id = requested_catch_id
      and (
        target.host_id = requested_user_id
        or exists (
          select 1
          from public.catch_participants participant
          where participant.catch_id = target.id
            and participant.user_id = requested_user_id
            and participant.status in ('approved', 'attended', 'no_show')
        )
      )
  );
$$;

create or replace function private.resolve_catch_attendance(
  requested_catch_id uuid,
  requested_user_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target public.catches%rowtype;
  self_confirmation text;
  attended_reports integer := 0;
  no_show_reports integer := 0;
begin
  select * into target
  from public.catches
  where id = requested_catch_id;

  if not found
    or target.status <> 'completed'
    or not private.is_original_catch_crew_member(requested_catch_id, requested_user_id)
  then
    return 'ineligible';
  end if;

  -- Completed Catches from before this migration keep their existing behavior.
  if target.attendance_required_at is null then
    if exists (
      select 1 from public.catch_participants participant
      where participant.catch_id = requested_catch_id
        and participant.user_id = requested_user_id
        and participant.status = 'no_show'
    ) then
      return 'no_show';
    end if;
    return 'attended';
  end if;

  select confirmation.attendance into self_confirmation
  from public.catch_attendance_confirmations confirmation
  where confirmation.catch_id = requested_catch_id
    and confirmation.confirmer_id = requested_user_id
    and confirmation.subject_id = requested_user_id;

  if self_confirmation is not null then
    return self_confirmation;
  end if;

  select
    count(*) filter (where confirmation.attendance = 'attended')::integer,
    count(*) filter (where confirmation.attendance = 'no_show')::integer
  into attended_reports, no_show_reports
  from public.catch_attendance_confirmations confirmation
  where confirmation.catch_id = requested_catch_id
    and confirmation.subject_id = requested_user_id
    and confirmation.confirmer_id <> requested_user_id;

  if no_show_reports >= 2 then
    return 'disputed';
  end if;
  if attended_reports >= 2 and no_show_reports = 0 then
    return 'attended';
  end if;
  return 'pending';
end;
$$;

create or replace function private.list_catch_attendance(
  requested_catch_id uuid
)
returns table (
  catch_id uuid,
  catch_title text,
  starts_at timestamptz,
  subject_id uuid,
  subject_name text,
  is_self boolean,
  my_confirmation text,
  resolved_status text
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
  if not private.is_original_catch_crew_member(requested_catch_id, caller_id) then
    raise exception 'Attendance is available only to this Catch crew';
  end if;
  if not exists (
    select 1 from public.catches target
    where target.id = requested_catch_id
      and target.status = 'completed'
  ) then
    raise exception 'Attendance opens after the Catch is completed';
  end if;

  return query
  with crew as (
    select target.host_id as user_id
    from public.catches target
    where target.id = requested_catch_id

    union

    select participant.user_id
    from public.catch_participants participant
    where participant.catch_id = requested_catch_id
      and participant.status in ('approved', 'attended', 'no_show')
  )
  select
    target.id,
    target.title,
    target.starts_at,
    member.user_id,
    private.member_display_name(profile.first_name, profile.last_initial),
    member.user_id = caller_id,
    confirmation.attendance,
    private.resolve_catch_attendance(target.id, member.user_id)
  from public.catches target
  join crew member on true
  join public.profiles profile on profile.user_id = member.user_id
  left join public.catch_attendance_confirmations confirmation
    on confirmation.catch_id = target.id
   and confirmation.confirmer_id = caller_id
   and confirmation.subject_id = member.user_id
  where target.id = requested_catch_id
  order by (member.user_id = caller_id) desc, member.user_id;
end;
$$;

create or replace function private.upsert_catch_attendance(
  requested_catch_id uuid,
  requested_subject_id uuid,
  requested_attendance text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if requested_attendance not in ('attended', 'no_show') then
    raise exception 'Choose attended or did not attend';
  end if;
  if not private.is_original_catch_crew_member(requested_catch_id, caller_id)
    or not private.is_original_catch_crew_member(requested_catch_id, requested_subject_id)
  then
    raise exception 'Attendance is limited to the completed Catch crew';
  end if;
  if not exists (
    select 1 from public.catches target
    where target.id = requested_catch_id
      and target.status = 'completed'
      and target.attendance_required_at is not null
  ) then
    raise exception 'This Catch does not need attendance confirmation';
  end if;
  if requested_subject_id <> caller_id
    and not exists (
      select 1
      from public.catch_attendance_confirmations self_confirmation
      where self_confirmation.catch_id = requested_catch_id
        and self_confirmation.confirmer_id = caller_id
        and self_confirmation.subject_id = caller_id
        and self_confirmation.attendance = 'attended'
    )
  then
    raise exception 'Confirm that you attended before reporting on the rest of the crew';
  end if;

  insert into public.catch_attendance_confirmations (
    catch_id, confirmer_id, subject_id, attendance, updated_at
  ) values (
    requested_catch_id, caller_id, requested_subject_id, requested_attendance, now()
  )
  on conflict (catch_id, confirmer_id, subject_id)
  do update set attendance = excluded.attendance, updated_at = now();
end;
$$;

create or replace function private.list_my_attendance_statuses()
returns table (
  catch_id uuid,
  attendance_required boolean,
  resolved_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    target.id,
    target.attendance_required_at is not null,
    private.resolve_catch_attendance(target.id, auth.uid())
  from public.catches target
  where target.status = 'completed'
    and private.is_original_catch_crew_member(target.id, auth.uid())
  order by target.starts_at desc;
$$;

create or replace function public.list_catch_attendance(requested_catch_id uuid)
returns table (
  catch_id uuid,
  catch_title text,
  starts_at timestamptz,
  subject_id uuid,
  subject_name text,
  is_self boolean,
  my_confirmation text,
  resolved_status text
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.list_catch_attendance(requested_catch_id) $$;

create or replace function public.upsert_catch_attendance(
  requested_catch_id uuid,
  requested_subject_id uuid,
  requested_attendance text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.upsert_catch_attendance(
    requested_catch_id,
    requested_subject_id,
    requested_attendance
  )
$$;

create or replace function public.list_my_attendance_statuses()
returns table (
  catch_id uuid,
  attendance_required boolean,
  resolved_status text
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.list_my_attendance_statuses() $$;

-- Preserve the existing direct-proposal validator/encryption function and add
-- an expanded wrapper that records the opt-in sharing choice.
create or replace function private.create_direct_catch_proposal_v2(
  requested_recipient_id uuid,
  requested_activity_type_id uuid,
  requested_starts_at timestamptz,
  requested_duration_minutes integer,
  requested_area_label text,
  requested_venue_id uuid default null,
  requested_message text default null,
  requested_location_type text default 'later',
  requested_private_place_name text default null,
  requested_exact_address text default null,
  requested_arrival_notes text default null,
  requested_latitude double precision default null,
  requested_longitude double precision default null,
  requested_allow_others_to_join boolean default false,
  requested_maximum_participants integer default 2
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_proposal_id uuid;
  normalized_maximum integer;
begin
  normalized_maximum := case
    when requested_allow_others_to_join then requested_maximum_participants
    else 2
  end;
  if requested_allow_others_to_join and normalized_maximum not between 3 and 12 then
    raise exception 'Open direct Catches need a total crew size between 3 and 12';
  end if;

  created_proposal_id := private.create_direct_catch_proposal(
    requested_recipient_id,
    requested_activity_type_id,
    requested_starts_at,
    requested_duration_minutes,
    requested_area_label,
    requested_venue_id,
    requested_message,
    requested_location_type,
    requested_private_place_name,
    requested_exact_address,
    requested_arrival_notes,
    requested_latitude,
    requested_longitude
  );

  update public.proposal_revisions
  set allow_others_to_join = requested_allow_others_to_join,
      maximum_participants = normalized_maximum
  where proposal_id = created_proposal_id
    and revision = 1;

  return created_proposal_id;
end;
$$;

create or replace function public.create_direct_catch_proposal_v2(
  requested_recipient_id uuid,
  requested_activity_type_id uuid,
  requested_starts_at timestamptz,
  requested_duration_minutes integer,
  requested_area_label text,
  requested_venue_id uuid default null,
  requested_message text default null,
  requested_location_type text default 'later',
  requested_private_place_name text default null,
  requested_exact_address text default null,
  requested_arrival_notes text default null,
  requested_latitude double precision default null,
  requested_longitude double precision default null,
  requested_allow_others_to_join boolean default false,
  requested_maximum_participants integer default 2
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_direct_catch_proposal_v2(
    requested_recipient_id,
    requested_activity_type_id,
    requested_starts_at,
    requested_duration_minutes,
    requested_area_label,
    requested_venue_id,
    requested_message,
    requested_location_type,
    requested_private_place_name,
    requested_exact_address,
    requested_arrival_notes,
    requested_latitude,
    requested_longitude,
    requested_allow_others_to_join,
    requested_maximum_participants
  )
$$;

create or replace function private.list_direct_catch_proposals_v2()
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
  location_type text,
  venue_id uuid,
  venue_name text,
  message text,
  accepted_catch_id uuid,
  created_at timestamptz,
  allow_others_to_join boolean,
  maximum_participants integer
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
    revision.location_type,
    revision.venue_id,
    venue.name,
    revision.message,
    proposals.accepted_catch_id,
    proposals.created_at,
    revision.allow_others_to_join,
    revision.maximum_participants
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

create or replace function public.list_direct_catch_proposals_v2()
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
  location_type text,
  venue_id uuid,
  venue_name text,
  message text,
  accepted_catch_id uuid,
  created_at timestamptz,
  allow_others_to_join boolean,
  maximum_participants integer
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.list_direct_catch_proposals_v2() $$;

-- Accepting an expanded proposal creates a public, approval-gated Catch. A
-- private exact location remains inaccessible until each additional member is
-- approved through the normal join-request flow.
create or replace function private.decide_direct_catch_proposal(
  requested_proposal_id uuid,
  approve boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  proposal_row public.catch_proposals%rowtype;
  revision_row public.proposal_revisions%rowtype;
  activity_row public.activity_types%rowtype;
  sender_name text;
  created_catch_id uuid;
begin
  if caller_id is null then raise exception 'Authentication required'; end if;

  select * into proposal_row
  from public.catch_proposals
  where id = requested_proposal_id and recipient_id = caller_id
  for update;
  if not found then raise exception 'Proposal not found'; end if;
  if proposal_row.status <> 'pending' or proposal_row.expires_at <= now() then
    raise exception 'This proposal is no longer awaiting a response';
  end if;
  if private.users_blocked(proposal_row.sender_id, caller_id) then
    raise exception 'This proposal is unavailable';
  end if;

  if not approve then
    update public.catch_proposals set status = 'declined', updated_at = now()
    where id = proposal_row.id;
    return null;
  end if;

  select * into revision_row
  from public.proposal_revisions
  where proposal_id = proposal_row.id and revision = proposal_row.current_revision;
  if revision_row.starts_at <= now() then raise exception 'The proposed time has already passed'; end if;
  if revision_row.location_type = 'private' and revision_row.private_location_encrypted is null then
    raise exception 'The private meeting location is unavailable';
  end if;

  select * into activity_row from public.activity_types where id = revision_row.activity_type_id;
  select first_name into sender_name from public.profiles where user_id = proposal_row.sender_id;

  insert into public.catches (
    host_id, kind, activity_type_id, title, description, starts_at,
    duration_minutes, timezone, venue_id, area_label, capacity,
    approval_required, visibility, intensity, minimum_age, metadata, status,
    expires_at
  ) values (
    proposal_row.sender_id,
    case when revision_row.starts_at <= now() + interval '3 hours'
      then 'now'::public.catch_kind else 'scheduled'::public.catch_kind end,
    revision_row.activity_type_id,
    activity_row.name || ' Catch',
    revision_row.message,
    revision_row.starts_at,
    revision_row.duration_minutes,
    'UTC',
    revision_row.venue_id,
    revision_row.area_label,
    revision_row.maximum_participants,
    revision_row.location_type = 'private' or revision_row.allow_others_to_join,
    case when revision_row.allow_others_to_join then 'public' else 'unlisted' end,
    'Easygoing',
    18,
    jsonb_build_object(
      'host_first_name', sender_name,
      'location_type', revision_row.location_type,
      'direct_proposal_id', proposal_row.id,
      'allow_others_to_join', revision_row.allow_others_to_join
    ),
    case when revision_row.allow_others_to_join then 'open' else 'confirmed' end,
    case when revision_row.starts_at <= now() + interval '3 hours'
      then revision_row.starts_at + make_interval(mins => revision_row.duration_minutes + 120)
      else null end
  ) returning id into created_catch_id;

  insert into public.catch_participants (catch_id, user_id, role, status, joined_at)
  values (created_catch_id, caller_id, 'member', 'approved', now());

  if revision_row.location_type = 'private' then
    insert into public.private_location_secrets (
      catch_id, encrypted_instructions, encryption_key_version, updated_at
    ) values (
      created_catch_id, revision_row.private_location_encrypted, 1, now()
    );
  end if;

  update public.catch_proposals
  set status = 'accepted', accepted_catch_id = created_catch_id, updated_at = now()
  where id = proposal_row.id;

  return created_catch_id;
end;
$$;

-- Completion now starts the attendance check and privately prompts each member.
create or replace function private.complete_catch(requested_catch_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target public.catches%rowtype;
  recipient_id uuid;
begin
  if caller_id is null then raise exception 'Authentication required'; end if;

  select * into target from public.catches where id = requested_catch_id for update;
  if not found then raise exception 'Catch not found'; end if;
  if target.host_id <> caller_id then raise exception 'Only the host can complete this Catch'; end if;
  if target.status = 'completed' then return; end if;
  if target.status not in ('open', 'full', 'confirmed') then raise exception 'This Catch cannot be completed'; end if;
  if target.starts_at + make_interval(mins => target.duration_minutes) > now() then
    raise exception 'Wait until the Catch is over before completing it';
  end if;

  update public.catches
  set status = 'completed', attendance_required_at = now(), updated_at = now()
  where id = target.id;

  insert into public.catch_status_history (
    catch_id, from_status, to_status, actor_id, reason_code
  ) values (target.id, target.status, 'completed', caller_id, 'host_confirmed');

  insert into public.catch_messages (catch_id, sender_id, kind, body)
  values (
    target.id,
    null,
    'system',
    'Catch complete. Confirm who attended before leaving post-Catch reviews.'
  );

  for recipient_id in
    select target.host_id
    union
    select participant.user_id
    from public.catch_participants participant
    where participant.catch_id = target.id
      and participant.status in ('approved', 'attended')
  loop
    perform private.queue_push_notification(
      recipient_id,
      'rating_reminders',
      'How did the Catch go?',
      'Confirm attendance, then complete your private post-Catch review.',
      jsonb_build_object(
        'path', '/catch-attendance/' || target.id::text,
        'catchId', target.id
      )
    );
  end loop;
end;
$$;

-- Reviews for new Catches require resolved attendance. Legacy completed
-- Catches retain their previous eligibility.
create or replace function private.is_completed_catch_crew_member(
  requested_catch_id uuid,
  requested_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.resolve_catch_attendance(requested_catch_id, requested_user_id) = 'attended';
$$;

create or replace function private.list_post_catch_review(requested_catch_id uuid)
returns table (
  catch_id uuid,
  catch_title text,
  starts_at timestamptz,
  subject_id uuid,
  subject_name text,
  score smallint,
  would_catch_again boolean,
  traits text[],
  private_note text,
  reviewed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception 'Authentication required'; end if;
  if not private.is_completed_catch_crew_member(requested_catch_id, caller_id) then
    raise exception 'Confirm that you attended before reviewing the Catch crew';
  end if;

  return query
  with crew as (
    select target.host_id as user_id from public.catches target
    where target.id = requested_catch_id
    union
    select participant.user_id from public.catch_participants participant
    where participant.catch_id = requested_catch_id
      and participant.status in ('approved', 'attended', 'no_show')
  )
  select
    target.id,
    target.title,
    target.starts_at,
    member.user_id,
    private.member_display_name(profile.first_name, profile.last_initial),
    review.score,
    review.would_catch_again,
    coalesce(review.traits, array[]::text[]),
    review.private_note,
    review.updated_at
  from public.catches target
  join crew member
    on member.user_id <> caller_id
   and private.resolve_catch_attendance(target.id, member.user_id) = 'attended'
  join public.profiles profile on profile.user_id = member.user_id
  left join public.ratings review
    on review.catch_id = target.id
   and review.rater_id = caller_id
   and review.subject_type = 'user'
   and review.subject_id = member.user_id
   and review.aspect = 'catch_mate'
  where target.id = requested_catch_id
  order by member.user_id;
end;
$$;

create or replace function private.list_my_post_catch_review_status()
returns table (catch_id uuid, eligible_count integer, completed_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  with eligible_catches as (
    select target.id
    from public.catches target
    where target.status = 'completed'
      and private.resolve_catch_attendance(target.id, auth.uid()) = 'attended'
  ), crew as (
    select eligible.id as catch_id, target.host_id as user_id
    from eligible_catches eligible
    join public.catches target on target.id = eligible.id
    union
    select eligible.id, participant.user_id
    from eligible_catches eligible
    join public.catch_participants participant on participant.catch_id = eligible.id
    where participant.status in ('approved', 'attended', 'no_show')
  ), attended_crew as (
    select crew.* from crew
    where private.resolve_catch_attendance(crew.catch_id, crew.user_id) = 'attended'
  )
  select
    eligible.id,
    count(attended_crew.user_id) filter (where attended_crew.user_id <> auth.uid())::integer,
    count(review.id)::integer
  from eligible_catches eligible
  left join attended_crew
    on attended_crew.catch_id = eligible.id
   and attended_crew.user_id <> auth.uid()
  left join public.ratings review
    on review.catch_id = eligible.id
   and review.rater_id = auth.uid()
   and review.subject_type = 'user'
   and review.subject_id = attended_crew.user_id
   and review.aspect = 'catch_mate'
  group by eligible.id;
$$;

revoke all on function private.is_original_catch_crew_member(uuid, uuid) from public, anon, authenticated;
revoke all on function private.resolve_catch_attendance(uuid, uuid) from public, anon, authenticated;
revoke all on function private.list_catch_attendance(uuid) from public, anon;
revoke all on function private.upsert_catch_attendance(uuid, uuid, text) from public, anon;
revoke all on function private.list_my_attendance_statuses() from public, anon;
revoke all on function public.list_catch_attendance(uuid) from public, anon;
revoke all on function public.upsert_catch_attendance(uuid, uuid, text) from public, anon;
revoke all on function public.list_my_attendance_statuses() from public, anon;
revoke all on function private.create_direct_catch_proposal_v2(
  uuid, uuid, timestamptz, integer, text, uuid, text, text, text, text, text,
  double precision, double precision, boolean, integer
) from public, anon;
revoke all on function public.create_direct_catch_proposal_v2(
  uuid, uuid, timestamptz, integer, text, uuid, text, text, text, text, text,
  double precision, double precision, boolean, integer
) from public, anon;
revoke all on function private.list_direct_catch_proposals_v2() from public, anon;
revoke all on function public.list_direct_catch_proposals_v2() from public, anon;

grant execute on function private.list_catch_attendance(uuid) to authenticated;
grant execute on function private.upsert_catch_attendance(uuid, uuid, text) to authenticated;
grant execute on function private.list_my_attendance_statuses() to authenticated;
grant execute on function public.list_catch_attendance(uuid) to authenticated;
grant execute on function public.upsert_catch_attendance(uuid, uuid, text) to authenticated;
grant execute on function public.list_my_attendance_statuses() to authenticated;
grant execute on function private.create_direct_catch_proposal_v2(
  uuid, uuid, timestamptz, integer, text, uuid, text, text, text, text, text,
  double precision, double precision, boolean, integer
) to authenticated;
grant execute on function public.create_direct_catch_proposal_v2(
  uuid, uuid, timestamptz, integer, text, uuid, text, text, text, text, text,
  double precision, double precision, boolean, integer
) to authenticated;
grant execute on function private.list_direct_catch_proposals_v2() to authenticated;
grant execute on function public.list_direct_catch_proposals_v2() to authenticated;

comment on function public.upsert_catch_attendance(uuid, uuid, text) is
'Stores a private, editable attendance confirmation. One no-show report never changes public reputation.';
comment on function public.create_direct_catch_proposal_v2(
  uuid, uuid, timestamptz, integer, text, uuid, text, text, text, text, text,
  double precision, double precision, boolean, integer
) is
'Creates a direct proposal that may opt into an approval-gated, discoverable Catch after acceptance.';

-- A reviewer's raw score and note-to-self remain private. This separate note is
-- intentionally shared with the subject, who alone controls whether it stays
-- private, is hidden, or is featured anonymously on their connected profile.
alter table public.ratings
  add column if not exists shared_note text
    check (shared_note is null or char_length(shared_note) <= 500),
  add column if not exists shared_note_updated_at timestamptz,
  add column if not exists shared_note_featured_at timestamptz,
  add column if not exists shared_note_hidden_at timestamptz,
  drop constraint if exists ratings_shared_note_visibility_check,
  add constraint ratings_shared_note_visibility_check check (
    shared_note_featured_at is null or shared_note_hidden_at is null
  );

create index if not exists ratings_featured_shared_note_idx
on public.ratings (subject_id, shared_note_featured_at desc)
where shared_note is not null and shared_note_featured_at is not null;

create or replace function private.upsert_shared_review_note(
  requested_catch_id uuid,
  requested_subject_id uuid,
  requested_shared_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  cleaned_note text := nullif(trim(coalesce(requested_shared_note, '')), '');
  previous_note text;
begin
  if caller_id is null then raise exception 'Authentication required'; end if;
  if cleaned_note is not null and char_length(cleaned_note) > 500 then
    raise exception 'Shared feedback must be 500 characters or fewer';
  end if;
  if not private.is_completed_catch_crew_member(requested_catch_id, caller_id)
    or not private.is_completed_catch_crew_member(requested_catch_id, requested_subject_id)
    or requested_subject_id = caller_id
  then
    raise exception 'Shared feedback requires a completed Catch together';
  end if;

  select review.shared_note into previous_note
  from public.ratings review
  where review.catch_id = requested_catch_id
    and review.rater_id = caller_id
    and review.subject_type = 'user'
    and review.subject_id = requested_subject_id
    and review.aspect = 'catch_mate'
  for update;
  if not found then
    raise exception 'Save the post-Catch review before sharing feedback';
  end if;

  update public.ratings
  set shared_note = cleaned_note,
      shared_note_updated_at = case
        when shared_note is distinct from cleaned_note then now()
        else shared_note_updated_at
      end,
      shared_note_featured_at = case
        when shared_note is distinct from cleaned_note then null
        else shared_note_featured_at
      end,
      shared_note_hidden_at = case
        when shared_note is distinct from cleaned_note then null
        else shared_note_hidden_at
      end,
      updated_at = now()
  where catch_id = requested_catch_id
    and rater_id = caller_id
    and subject_type = 'user'
    and subject_id = requested_subject_id
    and aspect = 'catch_mate';

  if cleaned_note is not null and previous_note is distinct from cleaned_note then
    perform private.queue_push_notification(
      requested_subject_id,
      'rating_reminders',
      'New private Catch feedback',
      'A Catch Mate shared a note with you. You decide whether it appears on your profile.',
      jsonb_build_object('path', '/shared-feedback')
    );
  end if;
end;
$$;

create or replace function private.list_my_authored_shared_feedback(
  requested_catch_id uuid
)
returns table (subject_id uuid, shared_note text)
language sql
stable
security definer
set search_path = ''
as $$
  select review.subject_id, review.shared_note
  from public.ratings review
  where review.catch_id = requested_catch_id
    and review.rater_id = auth.uid()
    and review.subject_type = 'user'
    and review.aspect = 'catch_mate';
$$;

create or replace function private.list_my_received_feedback()
returns table (
  feedback_id uuid,
  catch_id uuid,
  catch_title text,
  starts_at timestamptz,
  author_id uuid,
  author_name text,
  shared_note text,
  visibility text,
  received_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception 'Authentication required'; end if;
  return query
  select
    review.id,
    target.id,
    target.title,
    target.starts_at,
    review.rater_id,
    private.member_display_name(author.first_name, author.last_initial),
    review.shared_note,
    case
      when review.shared_note_featured_at is not null then 'featured'
      when review.shared_note_hidden_at is not null then 'hidden'
      else 'private'
    end,
    coalesce(review.shared_note_updated_at, review.updated_at)
  from public.ratings review
  join public.catches target on target.id = review.catch_id
  join public.profiles author on author.user_id = review.rater_id
  where review.subject_type = 'user'
    and review.subject_id = caller_id
    and review.aspect = 'catch_mate'
    and review.shared_note is not null
    and not private.users_blocked(review.rater_id, caller_id)
  order by review.updated_at desc;
end;
$$;

create or replace function private.set_my_shared_feedback_visibility(
  requested_feedback_id uuid,
  requested_visibility text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception 'Authentication required'; end if;
  if requested_visibility not in ('private', 'featured', 'hidden') then
    raise exception 'Choose private, featured, or hidden';
  end if;
  update public.ratings
  set shared_note_featured_at = case when requested_visibility = 'featured' then now() else null end,
      shared_note_hidden_at = case when requested_visibility = 'hidden' then now() else null end,
      updated_at = now()
  where id = requested_feedback_id
    and subject_type = 'user'
    and subject_id = caller_id
    and aspect = 'catch_mate'
    and shared_note is not null;
  if not found then raise exception 'Shared feedback not found'; end if;
end;
$$;

create or replace function private.list_featured_profile_feedback(
  requested_user_id uuid
)
returns table (
  feedback_id uuid,
  shared_note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception 'Authentication required'; end if;
  if caller_id <> requested_user_id
    and not private.can_direct_message(caller_id, requested_user_id)
  then
    raise exception 'Participant profile not found';
  end if;
  if not exists (
    select 1 from public.profiles profile
    where profile.user_id = requested_user_id and profile.catch_card_visible
  ) then
    return;
  end if;

  return query
  select review.id, review.shared_note
  from public.ratings review
  where review.subject_type = 'user'
    and review.subject_id = requested_user_id
    and review.aspect = 'catch_mate'
    and review.shared_note is not null
    and review.shared_note_featured_at is not null
    and review.shared_note_hidden_at is null
    and not private.users_blocked(review.rater_id, requested_user_id)
  order by review.shared_note_featured_at desc
  limit 6;
end;
$$;

create or replace function public.upsert_shared_review_note(
  requested_catch_id uuid,
  requested_subject_id uuid,
  requested_shared_note text default null
)
returns void language sql security invoker set search_path = ''
as $$ select private.upsert_shared_review_note(requested_catch_id, requested_subject_id, requested_shared_note) $$;

create or replace function public.list_my_authored_shared_feedback(requested_catch_id uuid)
returns table (subject_id uuid, shared_note text)
language sql stable security invoker set search_path = ''
as $$ select * from private.list_my_authored_shared_feedback(requested_catch_id) $$;

create or replace function public.list_my_received_feedback()
returns table (
  feedback_id uuid, catch_id uuid, catch_title text, starts_at timestamptz,
  author_id uuid, author_name text, shared_note text, visibility text, received_at timestamptz
)
language sql stable security invoker set search_path = ''
as $$ select * from private.list_my_received_feedback() $$;

create or replace function public.set_my_shared_feedback_visibility(
  requested_feedback_id uuid,
  requested_visibility text
)
returns void language sql security invoker set search_path = ''
as $$ select private.set_my_shared_feedback_visibility(requested_feedback_id, requested_visibility) $$;

create or replace function public.list_featured_profile_feedback(requested_user_id uuid)
returns table (feedback_id uuid, shared_note text)
language sql stable security invoker set search_path = ''
as $$ select * from private.list_featured_profile_feedback(requested_user_id) $$;

revoke all on function private.upsert_shared_review_note(uuid, uuid, text) from public, anon;
revoke all on function private.list_my_authored_shared_feedback(uuid) from public, anon;
revoke all on function private.list_my_received_feedback() from public, anon;
revoke all on function private.set_my_shared_feedback_visibility(uuid, text) from public, anon;
revoke all on function private.list_featured_profile_feedback(uuid) from public, anon;
revoke all on function public.upsert_shared_review_note(uuid, uuid, text) from public, anon;
revoke all on function public.list_my_authored_shared_feedback(uuid) from public, anon;
revoke all on function public.list_my_received_feedback() from public, anon;
revoke all on function public.set_my_shared_feedback_visibility(uuid, text) from public, anon;
revoke all on function public.list_featured_profile_feedback(uuid) from public, anon;

grant execute on function private.upsert_shared_review_note(uuid, uuid, text) to authenticated;
grant execute on function private.list_my_authored_shared_feedback(uuid) to authenticated;
grant execute on function private.list_my_received_feedback() to authenticated;
grant execute on function private.set_my_shared_feedback_visibility(uuid, text) to authenticated;
grant execute on function private.list_featured_profile_feedback(uuid) to authenticated;
grant execute on function public.upsert_shared_review_note(uuid, uuid, text) to authenticated;
grant execute on function public.list_my_authored_shared_feedback(uuid) to authenticated;
grant execute on function public.list_my_received_feedback() to authenticated;
grant execute on function public.set_my_shared_feedback_visibility(uuid, text) to authenticated;
grant execute on function public.list_featured_profile_feedback(uuid) to authenticated;

comment on column public.ratings.shared_note is
'Optional feedback intentionally shared with the subject. Separate from the reviewer-only private_note.';
comment on function public.set_my_shared_feedback_visibility(uuid, text) is
'Lets the feedback recipient keep a shared note private, hide it, or feature it anonymously on their profile.';
