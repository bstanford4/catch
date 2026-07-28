-- Saved Catch Mates, private friend codes, and direct Catch proposals.
--
-- Catch Mate rows are one-way saves. Redeeming a private friend code creates a
-- mutual save. All profile joins and mutations happen through authorization-
-- checked functions so the client never receives a searchable user directory.

create table if not exists public.catch_mates (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  mate_id uuid not null references public.profiles(user_id) on delete cascade,
  source text not null check (source in ('shared_catch', 'friend_code')),
  created_at timestamptz not null default now(),
  primary key (user_id, mate_id),
  check (user_id <> mate_id)
);

create table if not exists public.catch_mate_invites (
  code text primary key check (code ~ '^[A-Z0-9]{10}$'),
  inviter_id uuid not null references public.profiles(user_id) on delete cascade,
  expires_at timestamptz not null,
  redeemed_by uuid references public.profiles(user_id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists catch_mates_mate_idx on public.catch_mates (mate_id);
create index if not exists catch_mate_invites_owner_idx
on public.catch_mate_invites (inviter_id, expires_at desc);

alter table public.catch_mates enable row level security;
alter table public.catch_mate_invites enable row level security;

grant all privileges on public.catch_mates, public.catch_mate_invites to service_role;

create or replace function private.users_shared_catch(first_user uuid, second_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.catches shared
    where shared.status not in ('draft', 'canceled', 'expired', 'disputed')
      and (
        shared.host_id = first_user
        or exists (
          select 1
          from public.catch_participants first_participant
          where first_participant.catch_id = shared.id
            and first_participant.user_id = first_user
            and first_participant.status in ('approved', 'attended')
        )
      )
      and (
        shared.host_id = second_user
        or exists (
          select 1
          from public.catch_participants second_participant
          where second_participant.catch_id = shared.id
            and second_participant.user_id = second_user
            and second_participant.status in ('approved', 'attended')
        )
      )
  )
$$;

create or replace function private.save_catch_mate(requested_mate_id uuid)
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
  if requested_mate_id is null or requested_mate_id = caller_id then
    raise exception 'Choose another Catch member';
  end if;
  if private.users_blocked(caller_id, requested_mate_id) then
    raise exception 'This Catch member is unavailable';
  end if;
  if not private.users_shared_catch(caller_id, requested_mate_id) then
    raise exception 'Catch Mates can be saved after you share an approved Catch';
  end if;

  insert into public.catch_mates (user_id, mate_id, source)
  values (caller_id, requested_mate_id, 'shared_catch')
  on conflict (user_id, mate_id) do nothing;
end
$$;

create or replace function private.remove_catch_mate(requested_mate_id uuid)
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
  delete from public.catch_mates
  where user_id = caller_id
    and mate_id = requested_mate_id;
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
    profiles.first_name,
    profiles.area_label,
    mates.source,
    mates.created_at
  from public.catch_mates mates
  join public.profiles profiles on profiles.user_id = mates.mate_id
  where mates.user_id = auth.uid()
    and not private.users_blocked(mates.user_id, mates.mate_id)
  order by mates.created_at desc
$$;

create or replace function private.create_catch_mate_invite()
returns table (
  invite_code text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  generated_code text;
  generated_expiry timestamptz := now() + interval '7 days';
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  delete from public.catch_mate_invites
  where inviter_id = caller_id
    and (expires_at <= now() or redeemed_at is not null);

  select invites.code, invites.expires_at
  into generated_code, generated_expiry
  from public.catch_mate_invites invites
  where invites.inviter_id = caller_id
    and invites.redeemed_at is null
    and invites.expires_at > now()
  order by invites.created_at desc
  limit 1;

  if generated_code is null then
    generated_expiry := now() + interval '7 days';
    loop
      generated_code := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 10));
      begin
        insert into public.catch_mate_invites (code, inviter_id, expires_at)
        values (generated_code, caller_id, generated_expiry);
        exit;
      exception when unique_violation then
        -- A collision is extraordinarily unlikely; generate another code.
      end;
    end loop;
  end if;

  return query select generated_code, generated_expiry;
end
$$;

create or replace function private.redeem_catch_mate_invite(requested_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  invite_row public.catch_mate_invites%rowtype;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into invite_row
  from public.catch_mate_invites
  where code = upper(trim(requested_code))
  for update;

  if not found or invite_row.expires_at <= now() or invite_row.redeemed_at is not null then
    raise exception 'That friend code is invalid or expired';
  end if;
  if invite_row.inviter_id = caller_id then
    raise exception 'Send this code to a friend instead of redeeming it yourself';
  end if;
  if private.users_blocked(caller_id, invite_row.inviter_id) then
    raise exception 'That friend code is unavailable';
  end if;

  update public.catch_mate_invites
  set redeemed_by = caller_id, redeemed_at = now()
  where code = invite_row.code;

  insert into public.catch_mates (user_id, mate_id, source)
  values
    (caller_id, invite_row.inviter_id, 'friend_code'),
    (invite_row.inviter_id, caller_id, 'friend_code')
  on conflict (user_id, mate_id) do nothing;

  return invite_row.inviter_id;
end
$$;

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
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if not exists (
    select 1
    from public.catch_mates
    where user_id = caller_id
      and mate_id = requested_recipient_id
  ) then
    raise exception 'Save this person as a Catch Mate before proposing a Catch';
  end if;
  if private.users_blocked(caller_id, requested_recipient_id) then
    raise exception 'This Catch Mate is unavailable';
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

  insert into public.catch_proposals (
    sender_id,
    recipient_id,
    status,
    current_revision,
    expires_at
  )
  values (
    caller_id,
    requested_recipient_id,
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
    other_profile.first_name,
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
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into proposal_row
  from public.catch_proposals
  where id = requested_proposal_id
    and recipient_id = caller_id
  for update;
  if not found then
    raise exception 'Proposal not found';
  end if;
  if proposal_row.status <> 'pending' or proposal_row.expires_at <= now() then
    raise exception 'This proposal is no longer awaiting a response';
  end if;
  if private.users_blocked(proposal_row.sender_id, caller_id) then
    raise exception 'This proposal is unavailable';
  end if;

  if not approve then
    update public.catch_proposals
    set status = 'declined', updated_at = now()
    where id = proposal_row.id;
    return null;
  end if;

  select *
  into revision_row
  from public.proposal_revisions
  where proposal_id = proposal_row.id
    and revision = proposal_row.current_revision;
  if revision_row.starts_at <= now() then
    raise exception 'The proposed time has already passed';
  end if;

  select * into activity_row
  from public.activity_types
  where id = revision_row.activity_type_id;
  select first_name into sender_name
  from public.profiles
  where user_id = proposal_row.sender_id;

  insert into public.catches (
    host_id,
    kind,
    activity_type_id,
    title,
    description,
    starts_at,
    duration_minutes,
    timezone,
    venue_id,
    area_label,
    capacity,
    approval_required,
    visibility,
    intensity,
    minimum_age,
    metadata,
    status,
    expires_at
  )
  values (
    proposal_row.sender_id,
    case
      when revision_row.starts_at <= now() + interval '3 hours'
        then 'now'::public.catch_kind
      else 'scheduled'::public.catch_kind
    end,
    revision_row.activity_type_id,
    activity_row.name || ' Catch',
    revision_row.message,
    revision_row.starts_at,
    revision_row.duration_minutes,
    'UTC',
    revision_row.venue_id,
    revision_row.area_label,
    2,
    false,
    'unlisted',
    'Easygoing',
    18,
    jsonb_build_object(
      'host_first_name', sender_name,
      'location_type', case when revision_row.venue_id is null then 'later' else 'catalog' end,
      'direct_proposal_id', proposal_row.id
    ),
    'confirmed',
    case
      when revision_row.starts_at <= now() + interval '3 hours'
        then revision_row.starts_at
          + make_interval(mins => revision_row.duration_minutes + 120)
      else null
    end
  )
  returning id into created_catch_id;

  insert into public.catch_participants (
    catch_id,
    user_id,
    role,
    status,
    joined_at
  )
  values (
    created_catch_id,
    caller_id,
    'member',
    'approved',
    now()
  );

  update public.catch_proposals
  set
    status = 'accepted',
    accepted_catch_id = created_catch_id,
    updated_at = now()
  where id = proposal_row.id;

  return created_catch_id;
end
$$;

create or replace function private.withdraw_direct_catch_proposal(requested_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  update public.catch_proposals
  set status = 'withdrawn', updated_at = now()
  where id = requested_proposal_id
    and sender_id = caller_id
    and status = 'pending';
  if not found then
    raise exception 'Pending proposal not found';
  end if;
end
$$;

create or replace function public.save_catch_mate(requested_mate_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.save_catch_mate(requested_mate_id) $$;

create or replace function public.remove_catch_mate(requested_mate_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.remove_catch_mate(requested_mate_id) $$;

create or replace function public.list_catch_mates()
returns table (
  mate_id uuid,
  first_name text,
  area_label text,
  source text,
  saved_at timestamptz
)
language sql security invoker set search_path = ''
as $$ select * from private.list_catch_mates() $$;

create or replace function public.create_catch_mate_invite()
returns table (invite_code text, expires_at timestamptz)
language sql security invoker set search_path = ''
as $$ select * from private.create_catch_mate_invite() $$;

create or replace function public.redeem_catch_mate_invite(requested_code text)
returns uuid language sql security invoker set search_path = ''
as $$ select private.redeem_catch_mate_invite(requested_code) $$;

create or replace function public.create_direct_catch_proposal(
  requested_recipient_id uuid,
  requested_activity_type_id uuid,
  requested_starts_at timestamptz,
  requested_duration_minutes integer,
  requested_area_label text,
  requested_venue_id uuid default null,
  requested_message text default null
)
returns uuid language sql security invoker set search_path = ''
as $$
  select private.create_direct_catch_proposal(
    requested_recipient_id,
    requested_activity_type_id,
    requested_starts_at,
    requested_duration_minutes,
    requested_area_label,
    requested_venue_id,
    requested_message
  )
$$;

create or replace function public.list_direct_catch_proposals()
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
language sql security invoker set search_path = ''
as $$ select * from private.list_direct_catch_proposals() $$;

create or replace function public.decide_direct_catch_proposal(
  requested_proposal_id uuid,
  approve boolean
)
returns uuid language sql security invoker set search_path = ''
as $$ select private.decide_direct_catch_proposal(requested_proposal_id, approve) $$;

create or replace function public.withdraw_direct_catch_proposal(requested_proposal_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.withdraw_direct_catch_proposal(requested_proposal_id) $$;

revoke all on function private.users_shared_catch(uuid, uuid) from public, anon;
revoke all on function private.save_catch_mate(uuid) from public, anon;
revoke all on function private.remove_catch_mate(uuid) from public, anon;
revoke all on function private.list_catch_mates() from public, anon;
revoke all on function private.create_catch_mate_invite() from public, anon;
revoke all on function private.redeem_catch_mate_invite(text) from public, anon;
revoke all on function private.create_direct_catch_proposal(uuid, uuid, timestamptz, integer, text, uuid, text) from public, anon;
revoke all on function private.list_direct_catch_proposals() from public, anon;
revoke all on function private.decide_direct_catch_proposal(uuid, boolean) from public, anon;
revoke all on function private.withdraw_direct_catch_proposal(uuid) from public, anon;

grant execute on function private.save_catch_mate(uuid) to authenticated;
grant execute on function private.remove_catch_mate(uuid) to authenticated;
grant execute on function private.list_catch_mates() to authenticated;
grant execute on function private.create_catch_mate_invite() to authenticated;
grant execute on function private.redeem_catch_mate_invite(text) to authenticated;
grant execute on function private.create_direct_catch_proposal(uuid, uuid, timestamptz, integer, text, uuid, text) to authenticated;
grant execute on function private.list_direct_catch_proposals() to authenticated;
grant execute on function private.decide_direct_catch_proposal(uuid, boolean) to authenticated;
grant execute on function private.withdraw_direct_catch_proposal(uuid) to authenticated;

revoke all on function public.save_catch_mate(uuid) from public, anon;
revoke all on function public.remove_catch_mate(uuid) from public, anon;
revoke all on function public.list_catch_mates() from public, anon;
revoke all on function public.create_catch_mate_invite() from public, anon;
revoke all on function public.redeem_catch_mate_invite(text) from public, anon;
revoke all on function public.create_direct_catch_proposal(uuid, uuid, timestamptz, integer, text, uuid, text) from public, anon;
revoke all on function public.list_direct_catch_proposals() from public, anon;
revoke all on function public.decide_direct_catch_proposal(uuid, boolean) from public, anon;
revoke all on function public.withdraw_direct_catch_proposal(uuid) from public, anon;

grant execute on function public.save_catch_mate(uuid) to authenticated;
grant execute on function public.remove_catch_mate(uuid) to authenticated;
grant execute on function public.list_catch_mates() to authenticated;
grant execute on function public.create_catch_mate_invite() to authenticated;
grant execute on function public.redeem_catch_mate_invite(text) to authenticated;
grant execute on function public.create_direct_catch_proposal(uuid, uuid, timestamptz, integer, text, uuid, text) to authenticated;
grant execute on function public.list_direct_catch_proposals() to authenticated;
grant execute on function public.decide_direct_catch_proposal(uuid, boolean) to authenticated;
grant execute on function public.withdraw_direct_catch_proposal(uuid) to authenticated;
