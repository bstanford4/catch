-- Contextual proposal and Catch messaging with unread state.
--
-- Messages remain attached to a proposal or Catch. Access is limited to the
-- two proposal participants, or to the Catch host and approved participants.

create table if not exists public.message_thread_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  catch_id uuid references public.catches(id) on delete cascade,
  proposal_id uuid references public.catch_proposals(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  check ((catch_id is not null)::integer + (proposal_id is not null)::integer = 1)
);

create unique index if not exists message_thread_reads_catch_user_idx
on public.message_thread_reads (user_id, catch_id)
where catch_id is not null;

create unique index if not exists message_thread_reads_proposal_user_idx
on public.message_thread_reads (user_id, proposal_id)
where proposal_id is not null;

alter table public.message_thread_reads enable row level security;

drop policy if exists "message thread reads own rows" on public.message_thread_reads;
create policy "message thread reads own rows"
on public.message_thread_reads for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.message_thread_reads to authenticated;
grant all privileges on public.message_thread_reads to service_role;

create or replace function private.can_access_message_context(
  requested_user_id uuid,
  requested_catch_id uuid,
  requested_proposal_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    requested_user_id is not null
    and (
      (
        requested_catch_id is not null
        and requested_proposal_id is null
        and exists (
          select 1
          from public.catches catch
          where catch.id = requested_catch_id
            and (
              catch.host_id = requested_user_id
              or exists (
                select 1
                from public.catch_participants participant
                where participant.catch_id = catch.id
                  and participant.user_id = requested_user_id
                  and participant.status in ('approved', 'attended')
              )
            )
            and not exists (
              select 1
              from public.blocks block
              where (
                block.blocker_id = requested_user_id
                and (
                  block.blocked_id = catch.host_id
                  or exists (
                    select 1
                    from public.catch_participants other_participant
                    where other_participant.catch_id = catch.id
                      and other_participant.user_id = block.blocked_id
                      and other_participant.status in ('approved', 'attended')
                  )
                )
              )
              or (
                block.blocked_id = requested_user_id
                and (
                  block.blocker_id = catch.host_id
                  or exists (
                    select 1
                    from public.catch_participants other_participant
                    where other_participant.catch_id = catch.id
                      and other_participant.user_id = block.blocker_id
                      and other_participant.status in ('approved', 'attended')
                  )
                )
              )
            )
        )
      )
      or
      (
        requested_proposal_id is not null
        and requested_catch_id is null
        and exists (
          select 1
          from public.catch_proposals proposal
          where proposal.id = requested_proposal_id
            and requested_user_id in (proposal.sender_id, proposal.recipient_id)
            and not private.users_blocked(proposal.sender_id, proposal.recipient_id)
        )
      )
    )
$$;

revoke all on function private.can_access_message_context(uuid, uuid, uuid)
from public, anon;
grant execute on function private.can_access_message_context(uuid, uuid, uuid)
to authenticated, service_role;

drop policy if exists "participants read catch messages" on public.catch_messages;
drop policy if exists "participants send catch messages" on public.catch_messages;
drop policy if exists "members read contextual messages" on public.catch_messages;
drop policy if exists "members send contextual messages" on public.catch_messages;

create policy "members read contextual messages"
on public.catch_messages for select to authenticated
using (
  private.can_access_message_context(
    (select auth.uid()),
    catch_messages.catch_id,
    catch_messages.proposal_id
  )
);

create policy "members send contextual messages"
on public.catch_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and kind = 'user'
  and private.can_access_message_context(
    (select auth.uid()),
    catch_messages.catch_id,
    catch_messages.proposal_id
  )
);

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
        select host_profile.first_name
        from public.profiles host_profile
        where host_profile.user_id = catch.host_id
          and catch.host_id <> auth.uid()
        union
        select participant_profile.first_name
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
      other_profile.first_name as title,
      'Proposal · ' || activity.name as context_label,
      activity.name as activity_name,
      activity.slug as activity_slug,
      activity.emoji as activity_emoji,
      other_profile.first_name as other_first_name,
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
      else coalesce(sender.first_name, 'Catch mate')
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

create or replace function private.mark_message_thread_read(
  requested_thread_type text,
  requested_thread_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if requested_thread_type = 'catch'
    and private.can_access_message_context(caller_id, requested_thread_id, null)
  then
    insert into public.message_thread_reads (user_id, catch_id, last_read_at)
    values (caller_id, requested_thread_id, now())
    on conflict (user_id, catch_id) where catch_id is not null
    do update set last_read_at = excluded.last_read_at;
  elsif requested_thread_type = 'proposal'
    and private.can_access_message_context(caller_id, null, requested_thread_id)
  then
    insert into public.message_thread_reads (user_id, proposal_id, last_read_at)
    values (caller_id, requested_thread_id, now())
    on conflict (user_id, proposal_id) where proposal_id is not null
    do update set last_read_at = excluded.last_read_at;
  else
    raise exception 'Message thread not found';
  end if;
end
$$;

create or replace function private.send_thread_message(
  requested_thread_type text,
  requested_thread_id uuid,
  requested_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_body text := trim(coalesce(requested_body, ''));
  created_message_id uuid;
  requested_catch_id uuid;
  requested_proposal_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if char_length(normalized_body) not between 1 and 2000 then
    raise exception 'Message must be between 1 and 2000 characters';
  end if;

  if requested_thread_type = 'catch' then
    requested_catch_id := requested_thread_id;
    if not private.can_access_message_context(caller_id, requested_catch_id, null)
      or not exists (
        select 1
        from public.catches catch
        where catch.id = requested_catch_id
          and catch.status in ('open', 'full', 'confirmed')
      )
    then
      raise exception 'This Catch thread is closed';
    end if;
  elsif requested_thread_type = 'proposal' then
    requested_proposal_id := requested_thread_id;
    if not private.can_access_message_context(caller_id, null, requested_proposal_id)
      or not exists (
        select 1
        from public.catch_proposals proposal
        where proposal.id = requested_proposal_id
          and proposal.status in ('pending', 'countered')
          and proposal.expires_at > now()
      )
    then
      raise exception 'This proposal thread is closed';
    end if;
  else
    raise exception 'Unknown message thread';
  end if;

  insert into public.catch_messages (
    catch_id,
    proposal_id,
    sender_id,
    kind,
    body
  )
  values (
    requested_catch_id,
    requested_proposal_id,
    caller_id,
    'user',
    normalized_body
  )
  returning id into created_message_id;

  perform private.mark_message_thread_read(requested_thread_type, requested_thread_id);
  return created_message_id;
end
$$;

create or replace function private.copy_proposal_message_to_thread()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(trim(coalesce(new.message, '')), '') is not null then
    insert into public.catch_messages (
      proposal_id,
      sender_id,
      kind,
      body,
      created_at
    )
    values (
      new.proposal_id,
      new.proposed_by,
      'user',
      trim(new.message),
      new.created_at
    );
  end if;
  return new;
end
$$;

drop trigger if exists copy_proposal_message_to_thread on public.proposal_revisions;
create trigger copy_proposal_message_to_thread
after insert on public.proposal_revisions
for each row execute function private.copy_proposal_message_to_thread();

insert into public.catch_messages (
  proposal_id,
  sender_id,
  kind,
  body,
  created_at
)
select
  revision.proposal_id,
  revision.proposed_by,
  'user',
  trim(revision.message),
  revision.created_at
from public.proposal_revisions revision
where nullif(trim(coalesce(revision.message, '')), '') is not null
  and not exists (
    select 1
    from public.catch_messages message
    where message.proposal_id = revision.proposal_id
  );

create or replace function private.write_participant_system_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant_name text;
begin
  if new.status = 'approved' and tg_op = 'INSERT' then
    select first_name into participant_name
    from public.profiles
    where user_id = new.user_id;

    insert into public.catch_messages (catch_id, kind, body)
    values (
      new.catch_id,
      'system',
      coalesce(participant_name, 'A Catch mate') || ' joined the Catch.'
    );
  elsif new.status = 'approved' and old.status is distinct from new.status then
    select first_name into participant_name
    from public.profiles
    where user_id = new.user_id;

    insert into public.catch_messages (catch_id, kind, body)
    values (
      new.catch_id,
      'system',
      coalesce(participant_name, 'A Catch mate') || ' joined the Catch.'
    );
  end if;
  return new;
end
$$;

drop trigger if exists write_participant_system_message on public.catch_participants;
create trigger write_participant_system_message
after insert or update of status on public.catch_participants
for each row execute function private.write_participant_system_message();

create or replace function private.write_catch_status_system_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status
    and new.status in ('canceled', 'completed')
  then
    insert into public.catch_messages (catch_id, kind, body)
    values (
      new.id,
      'system',
      case
        when new.status = 'canceled' then 'This Catch was canceled.'
        else 'This Catch was marked complete.'
      end
    );
  end if;
  return new;
end
$$;

drop trigger if exists write_catch_status_system_message on public.catches;
create trigger write_catch_status_system_message
after update of status on public.catches
for each row execute function private.write_catch_status_system_message();

create or replace function public.list_message_threads()
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
security invoker
set search_path = ''
as $$ select * from private.list_message_threads() $$;

create or replace function public.list_thread_messages(
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
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.list_thread_messages(requested_thread_type, requested_thread_id)
$$;

create or replace function public.mark_message_thread_read(
  requested_thread_type text,
  requested_thread_id uuid
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.mark_message_thread_read(requested_thread_type, requested_thread_id)
$$;

create or replace function public.send_thread_message(
  requested_thread_type text,
  requested_thread_id uuid,
  requested_body text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.send_thread_message(
    requested_thread_type,
    requested_thread_id,
    requested_body
  )
$$;

revoke all on function private.list_message_threads() from public, anon;
revoke all on function private.list_thread_messages(text, uuid) from public, anon;
revoke all on function private.mark_message_thread_read(text, uuid) from public, anon;
revoke all on function private.send_thread_message(text, uuid, text) from public, anon;
revoke all on function private.copy_proposal_message_to_thread() from public, anon, authenticated;
revoke all on function private.write_participant_system_message() from public, anon, authenticated;
revoke all on function private.write_catch_status_system_message() from public, anon, authenticated;

grant execute on function private.list_message_threads() to authenticated;
grant execute on function private.list_thread_messages(text, uuid) to authenticated;
grant execute on function private.mark_message_thread_read(text, uuid) to authenticated;
grant execute on function private.send_thread_message(text, uuid, text) to authenticated;

revoke all on function public.list_message_threads() from public, anon;
revoke all on function public.list_thread_messages(text, uuid) from public, anon;
revoke all on function public.mark_message_thread_read(text, uuid) from public, anon;
revoke all on function public.send_thread_message(text, uuid, text) from public, anon;

grant execute on function public.list_message_threads() to authenticated;
grant execute on function public.list_thread_messages(text, uuid) to authenticated;
grant execute on function public.mark_message_thread_read(text, uuid) to authenticated;
grant execute on function public.send_thread_message(text, uuid, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'catch_messages'
    )
  then
    alter publication supabase_realtime add table public.catch_messages;
  end if;
end
$$;
