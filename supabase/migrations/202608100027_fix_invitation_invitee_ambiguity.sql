-- Rename the notification loop variable so PostgreSQL does not confuse it
-- with catch_invitations.invitee_id in the INSERT/ON CONFLICT statement.

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
  notified_invitee_id uuid;
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

  for notified_invitee_id in
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
      notified_invitee_id,
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

revoke all on function private.sync_catch_mate_invitations(uuid, uuid[]) from public, anon;
grant execute on function private.sync_catch_mate_invitations(uuid, uuid[])
to authenticated, service_role;

comment on function private.sync_catch_mate_invitations(uuid, uuid[]) is
'Host-only invitation reconciliation with an unambiguous notification loop variable.';
