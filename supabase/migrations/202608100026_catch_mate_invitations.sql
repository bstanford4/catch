-- Catch Mate invitations for newly created and existing upcoming Catches.
-- Hosts may invite only saved Catch Mates. Invitees explicitly accept before
-- becoming approved participants or gaining access to a private location.

create table if not exists public.catch_invitations (
  id uuid primary key default gen_random_uuid(),
  catch_id uuid not null references public.catches(id) on delete cascade,
  inviter_id uuid not null references public.profiles(user_id) on delete cascade,
  invitee_id uuid not null references public.profiles(user_id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'withdrawn', 'expired')),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (catch_id, invitee_id),
  check (inviter_id <> invitee_id)
);

create index if not exists catch_invitations_invitee_idx
on public.catch_invitations (invitee_id, status, created_at desc);

create index if not exists catch_invitations_host_idx
on public.catch_invitations (inviter_id, catch_id, status);

alter table public.catch_invitations enable row level security;
revoke all privileges on public.catch_invitations from anon, authenticated;
grant all privileges on public.catch_invitations to service_role;

create or replace function private.protect_catch_invitation_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_capacity integer;
  approved_count integer;
  reserved_count integer;
begin
  if new.status not in ('approved', 'attended')
    or (tg_op = 'UPDATE' and old.status in ('approved', 'attended')) then
    return new;
  end if;

  select target.capacity into target_capacity
  from public.catches target
  where target.id = new.catch_id;

  select count(*) into approved_count
  from public.catch_participants participant
  where participant.catch_id = new.catch_id
    and participant.user_id <> new.user_id
    and participant.status in ('approved', 'attended');

  select count(*) into reserved_count
  from public.catch_invitations invitation
  where invitation.catch_id = new.catch_id
    and invitation.invitee_id <> new.user_id
    and invitation.status = 'pending';

  if approved_count + reserved_count >= target_capacity - 1 then
    raise exception 'The remaining Catch spots are reserved for invited Catch Mates';
  end if;
  return new;
end
$$;

drop trigger if exists protect_catch_invitation_capacity_before_membership
on public.catch_participants;
create trigger protect_catch_invitation_capacity_before_membership
before insert or update of status on public.catch_participants
for each row execute function private.protect_catch_invitation_capacity();

create or replace function private.sync_catch_mate_invitations(
  requested_catch_id uuid,
  requested_invitee_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target public.catches%rowtype;
  normalized_ids uuid[];
  invalid_count integer;
  occupied_count integer;
  invitee_id uuid;
  host_name text;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select * into target
  from public.catches
  where id = requested_catch_id
    and host_id = caller_id
  for update;

  if not found then
    raise exception 'Only the Catch host can manage invitations';
  end if;
  if target.status not in ('open', 'full', 'confirmed') or target.starts_at <= now() then
    raise exception 'Invitations can be changed only for an upcoming Catch';
  end if;

  select coalesce(array_agg(candidate.id order by candidate.id), '{}'::uuid[])
  into normalized_ids
  from (
    select distinct unnest(coalesce(requested_invitee_ids, '{}'::uuid[])) as id
  ) candidate
  where candidate.id is not null
    and candidate.id <> caller_id;

  select count(*) into invalid_count
  from unnest(normalized_ids) selected(id)
  where not exists (
    select 1
    from public.catch_participants participant
    where participant.catch_id = target.id
      and participant.user_id = selected.id
      and participant.status in ('approved', 'attended')
  )
  and (
    not exists (
      select 1
      from public.catch_mates mates
      where mates.user_id = caller_id
        and mates.mate_id = selected.id
    )
    or private.users_blocked(caller_id, selected.id)
  );

  if invalid_count > 0 then
    raise exception 'Every invited person must be one of your current Catch Mates';
  end if;

  select count(*) into occupied_count
  from public.catch_participants participant
  where participant.catch_id = target.id
    and participant.status in ('approved', 'attended');

  occupied_count := occupied_count + (
    select count(*)
    from unnest(normalized_ids) selected(id)
    where not exists (
      select 1
      from public.catch_participants participant
      where participant.catch_id = target.id
        and participant.user_id = selected.id
        and participant.status in ('approved', 'attended')
    )
  );

  if occupied_count > target.capacity - 1 then
    raise exception 'The selected Catch Mates exceed the available crew spots';
  end if;

  update public.catch_invitations invitation
  set status = 'withdrawn', responded_at = now(), updated_at = now()
  where invitation.catch_id = target.id
    and invitation.inviter_id = caller_id
    and invitation.status = 'pending'
    and not (invitation.invitee_id = any(normalized_ids));

  select private.member_display_name(profile.first_name, profile.last_initial)
  into host_name
  from public.profiles profile
  where profile.user_id = caller_id;

  for invitee_id in
    insert into public.catch_invitations as current_invitation (
      catch_id, inviter_id, invitee_id, status, responded_at, created_at, updated_at
    )
    select target.id, caller_id, selected.id, 'pending', null, now(), now()
    from unnest(normalized_ids) selected(id)
    where not exists (
      select 1
      from public.catch_participants participant
      where participant.catch_id = target.id
        and participant.user_id = selected.id
        and participant.status in ('approved', 'attended')
    )
    on conflict (catch_id, invitee_id) do update set
      inviter_id = excluded.inviter_id,
      status = 'pending',
      responded_at = null,
      created_at = now(),
      updated_at = now()
    where current_invitation.status in ('declined', 'withdrawn', 'expired')
    returning current_invitation.invitee_id
  loop
    perform private.queue_push_notification(
      invitee_id,
      'proposals',
      coalesce(host_name, 'A Catch Mate') || ' invited you to a Catch',
      target.title || ' starts ' || to_char(target.starts_at at time zone target.timezone, 'Dy, Mon FMDD at FMHH12:MI AM'),
      jsonb_build_object('path', '/proposals', 'catchId', target.id)
    );
  end loop;

  if occupied_count >= target.capacity - 1 then
    update public.catches set status = 'full', updated_at = now()
    where id = target.id and status in ('open', 'full');
  elsif target.status = 'full' then
    update public.catches set status = 'open', updated_at = now()
    where id = target.id;
  end if;
end
$$;

create or replace function public.sync_catch_mate_invitations(
  requested_catch_id uuid,
  requested_invitee_ids uuid[] default '{}'::uuid[]
)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.sync_catch_mate_invitations(requested_catch_id, requested_invitee_ids)
$$;

create or replace function private.list_host_catch_invitations(requested_catch_id uuid)
returns table (
  invitee_id uuid,
  invitee_name text,
  status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.catches target
    where target.id = requested_catch_id
      and target.host_id = auth.uid()
  ) then
    raise exception 'Only the Catch host can view its invitations';
  end if;

  return query
  select
    invitation.invitee_id,
    private.member_display_name(profile.first_name, profile.last_initial),
    invitation.status
  from public.catch_invitations invitation
  join public.profiles profile on profile.user_id = invitation.invitee_id
  where invitation.catch_id = requested_catch_id
    and invitation.inviter_id = auth.uid()
    and invitation.status in ('pending', 'accepted')
  order by profile.first_name, profile.last_initial;
end
$$;

create or replace function public.list_host_catch_invitations(requested_catch_id uuid)
returns table (
  invitee_id uuid,
  invitee_name text,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.list_host_catch_invitations(requested_catch_id)
$$;

create or replace function private.list_my_received_catch_invitations()
returns table (
  invitation_id uuid,
  catch_id uuid,
  catch_title text,
  host_name text,
  activity_type_id uuid,
  activity_slug text,
  activity_name text,
  activity_emoji text,
  starts_at timestamptz,
  duration_minutes integer,
  area_label text,
  location_type text,
  venue_name text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    invitation.id,
    target.id,
    target.title,
    private.member_display_name(host_profile.first_name, host_profile.last_initial),
    activity.id,
    activity.slug,
    activity.name,
    activity.emoji,
    target.starts_at,
    target.duration_minutes,
    target.area_label,
    coalesce(target.metadata->>'location_type', case when target.venue_id is null then 'later' else 'catalog' end),
    venue.name,
    case
      when invitation.status = 'pending' and (target.starts_at <= now() or target.status in ('canceled', 'completed', 'expired')) then 'expired'
      else invitation.status
    end,
    invitation.created_at
  from public.catch_invitations invitation
  join public.catches target on target.id = invitation.catch_id
  join public.profiles host_profile on host_profile.user_id = target.host_id
  join public.activity_types activity on activity.id = target.activity_type_id
  left join public.venues venue on venue.id = target.venue_id
  where invitation.invitee_id = auth.uid()
    and not private.users_blocked(invitation.inviter_id, invitation.invitee_id)
  order by
    case when invitation.status = 'pending' and target.starts_at > now() then 0 else 1 end,
    target.starts_at desc
$$;

create or replace function public.list_my_received_catch_invitations()
returns table (
  invitation_id uuid,
  catch_id uuid,
  catch_title text,
  host_name text,
  activity_type_id uuid,
  activity_slug text,
  activity_name text,
  activity_emoji text,
  starts_at timestamptz,
  duration_minutes integer,
  area_label text,
  location_type text,
  venue_name text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.list_my_received_catch_invitations()
$$;

create or replace function private.decide_catch_invitation(
  requested_invitation_id uuid,
  approve boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  invitation public.catch_invitations%rowtype;
  target public.catches%rowtype;
  approved_count integer;
  next_status text;
  invitee_name text;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select * into invitation
  from public.catch_invitations
  where id = requested_invitation_id
    and invitee_id = caller_id
  for update;

  if not found then
    raise exception 'Catch invitation not found';
  end if;
  if invitation.status <> 'pending' then
    raise exception 'This invitation has already been decided';
  end if;

  select * into target
  from public.catches
  where id = invitation.catch_id
  for update;

  if not found or target.starts_at <= now()
    or target.status not in ('open', 'full', 'confirmed') then
    update public.catch_invitations
    set status = 'expired', responded_at = now(), updated_at = now()
    where id = invitation.id;
    raise exception 'This Catch invitation has expired';
  end if;

  if private.users_blocked(invitation.inviter_id, caller_id) then
    raise exception 'This Catch invitation is unavailable';
  end if;
  if target.minimum_age = 21 and not exists (
    select 1 from public.profiles profile
    where profile.user_id = caller_id
      and profile.age_21_affirmed_at is not null
  ) then
    raise exception 'This Catch is limited to members who affirmed they are 21+';
  end if;

  if approve then
    select count(*) into approved_count
    from public.catch_participants participant
    where participant.catch_id = target.id
      and participant.status in ('approved', 'attended');
    if approved_count >= target.capacity - 1 then
      raise exception 'This Catch is already full';
    end if;

    insert into public.catch_participants (
      catch_id, user_id, role, status, joined_at, updated_at
    ) values (
      target.id, caller_id, 'member', 'approved', now(), now()
    )
    on conflict (catch_id, user_id) do update set
      status = 'approved',
      joined_at = coalesce(public.catch_participants.joined_at, now()),
      updated_at = now();

    next_status := 'accepted';
    if approved_count + 1 >= target.capacity - 1 then
      update public.catches set status = 'full', updated_at = now()
      where id = target.id;
    end if;
  else
    next_status := 'declined';
  end if;

  update public.catch_invitations
  set status = next_status, responded_at = now(), updated_at = now()
  where id = invitation.id;

  select count(*) into approved_count
  from public.catch_participants participant
  where participant.catch_id = target.id
    and participant.status in ('approved', 'attended');

  approved_count := approved_count + (
    select count(*)
    from public.catch_invitations pending_invitation
    where pending_invitation.catch_id = target.id
      and pending_invitation.status = 'pending'
  );

  if approved_count < target.capacity - 1 and target.status = 'full' then
    update public.catches set status = 'open', updated_at = now()
    where id = target.id;
  end if;

  select private.member_display_name(profile.first_name, profile.last_initial)
  into invitee_name
  from public.profiles profile
  where profile.user_id = caller_id;

  perform private.queue_push_notification(
    invitation.inviter_id,
    'proposals',
    coalesce(invitee_name, 'Your Catch Mate') || case when approve then ' accepted' else ' declined' end,
    case when approve then 'They are joining ' else 'They declined ' end || target.title || '.',
    jsonb_build_object('path', '/catch/' || target.id, 'catchId', target.id)
  );

  return case when approve then target.id else null end;
end
$$;

create or replace function public.decide_catch_invitation(
  requested_invitation_id uuid,
  approve boolean
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select private.decide_catch_invitation(requested_invitation_id, approve)
$$;

revoke all on function private.sync_catch_mate_invitations(uuid, uuid[]) from public, anon;
revoke all on function private.protect_catch_invitation_capacity() from public, anon;
revoke all on function private.list_host_catch_invitations(uuid) from public, anon;
revoke all on function private.list_my_received_catch_invitations() from public, anon;
revoke all on function private.decide_catch_invitation(uuid, boolean) from public, anon;

grant execute on function private.sync_catch_mate_invitations(uuid, uuid[]) to authenticated, service_role;
grant execute on function private.protect_catch_invitation_capacity() to service_role;
grant execute on function private.list_host_catch_invitations(uuid) to authenticated, service_role;
grant execute on function private.list_my_received_catch_invitations() to authenticated, service_role;
grant execute on function private.decide_catch_invitation(uuid, boolean) to authenticated, service_role;

revoke all on function public.sync_catch_mate_invitations(uuid, uuid[]) from public, anon;
revoke all on function public.list_host_catch_invitations(uuid) from public, anon;
revoke all on function public.list_my_received_catch_invitations() from public, anon;
revoke all on function public.decide_catch_invitation(uuid, boolean) from public, anon;

grant execute on function public.sync_catch_mate_invitations(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.list_host_catch_invitations(uuid) to authenticated, service_role;
grant execute on function public.list_my_received_catch_invitations() to authenticated, service_role;
grant execute on function public.decide_catch_invitation(uuid, boolean) to authenticated, service_role;

comment on table public.catch_invitations is
'Private host-to-Catch-Mate invitations. Acceptance is required before participant or private-location access.';
comment on function public.sync_catch_mate_invitations(uuid, uuid[]) is
'Reconciles a host-selected Catch Mate list, reserves capacity, and withdraws only pending invitations that were deselected.';
comment on function public.decide_catch_invitation(uuid, boolean) is
'Lets the invited Catch Mate accept or decline. Acceptance atomically adds approved Catch membership.';
