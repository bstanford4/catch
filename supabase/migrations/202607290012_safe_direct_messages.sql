-- Private one-to-one messaging for Catch Mates and people who have shared an
-- approved Catch. Blocks immediately remove access in both directions.

create table if not exists public.direct_message_threads (
  id uuid primary key default gen_random_uuid(),
  user_one_id uuid not null references public.profiles(user_id) on delete cascade,
  user_two_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_one_id, user_two_id),
  check (user_one_id::text < user_two_id::text)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.direct_message_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(user_id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.direct_message_thread_reads (
  thread_id uuid not null references public.direct_message_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create index if not exists direct_messages_thread_created_idx
on public.direct_messages (thread_id, created_at desc);

alter table public.direct_message_threads enable row level security;
alter table public.direct_messages enable row level security;
alter table public.direct_message_thread_reads enable row level security;

create or replace function private.can_direct_message(
  requested_user_id uuid,
  requested_other_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    requested_user_id is not null
    and requested_other_id is not null
    and requested_user_id <> requested_other_id
    and not private.users_blocked(requested_user_id, requested_other_id)
    and (
      exists (
        select 1
        from public.catch_mates mate
        where (mate.user_id = requested_user_id and mate.mate_id = requested_other_id)
           or (mate.user_id = requested_other_id and mate.mate_id = requested_user_id)
      )
      or exists (
        select 1
        from public.catches shared
        where shared.status not in ('draft', 'canceled', 'disputed')
          and (
            shared.host_id = requested_user_id
            or exists (
              select 1
              from public.catch_participants first_participant
              where first_participant.catch_id = shared.id
                and first_participant.user_id = requested_user_id
                and first_participant.status in ('approved', 'attended')
            )
          )
          and (
            shared.host_id = requested_other_id
            or exists (
              select 1
              from public.catch_participants second_participant
              where second_participant.catch_id = shared.id
                and second_participant.user_id = requested_other_id
                and second_participant.status in ('approved', 'attended')
            )
          )
      )
    )
$$;

drop policy if exists "members read direct threads" on public.direct_message_threads;
create policy "members read direct threads"
on public.direct_message_threads for select to authenticated
using (
  (select auth.uid()) in (user_one_id, user_two_id)
  and private.can_direct_message(user_one_id, user_two_id)
);

drop policy if exists "members read direct messages" on public.direct_messages;
create policy "members read direct messages"
on public.direct_messages for select to authenticated
using (
  exists (
    select 1
    from public.direct_message_threads thread
    where thread.id = direct_messages.thread_id
      and (select auth.uid()) in (thread.user_one_id, thread.user_two_id)
      and private.can_direct_message(thread.user_one_id, thread.user_two_id)
  )
);

drop policy if exists "members read own direct state" on public.direct_message_thread_reads;
create policy "members read own direct state"
on public.direct_message_thread_reads for select to authenticated
using (user_id = (select auth.uid()));

grant select on public.direct_message_threads, public.direct_messages to authenticated;
grant all privileges on
  public.direct_message_threads,
  public.direct_messages,
  public.direct_message_thread_reads
to service_role;

create or replace function private.start_direct_message(requested_other_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  first_id uuid;
  second_id uuid;
  found_thread_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if not private.can_direct_message(caller_id, requested_other_id) then
    raise exception 'Direct messages are available only to connected Catch members';
  end if;

  if caller_id::text < requested_other_id::text then
    first_id := caller_id;
    second_id := requested_other_id;
  else
    first_id := requested_other_id;
    second_id := caller_id;
  end if;

  select thread.id
  into found_thread_id
  from public.direct_message_threads thread
  where thread.user_one_id = first_id
    and thread.user_two_id = second_id;

  if found_thread_id is null then
    insert into public.direct_message_threads (user_one_id, user_two_id)
    values (first_id, second_id)
    on conflict (user_one_id, user_two_id) do nothing
    returning id into found_thread_id;

    if found_thread_id is null then
      select thread.id
      into found_thread_id
      from public.direct_message_threads thread
      where thread.user_one_id = first_id
        and thread.user_two_id = second_id;
    end if;
  end if;

  return found_thread_id;
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
    other_profile.first_name,
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
    coalesce(sender.first_name, 'Catch mate'),
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

create or replace function private.mark_direct_message_read(requested_thread_id uuid)
returns void
language plpgsql
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

  insert into public.direct_message_thread_reads (thread_id, user_id, last_read_at)
  values (requested_thread_id, caller_id, now())
  on conflict (thread_id, user_id)
  do update set last_read_at = excluded.last_read_at;
end
$$;

create or replace function private.send_direct_message(
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
  thread_row public.direct_message_threads%rowtype;
  created_message_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if char_length(normalized_body) not between 1 and 2000 then
    raise exception 'Message must be between 1 and 2000 characters';
  end if;

  select *
  into thread_row
  from public.direct_message_threads
  where id = requested_thread_id
    and caller_id in (user_one_id, user_two_id);

  if not found
    or not private.can_direct_message(thread_row.user_one_id, thread_row.user_two_id)
  then
    raise exception 'This direct conversation is unavailable';
  end if;

  insert into public.direct_messages (thread_id, sender_id, body)
  values (requested_thread_id, caller_id, normalized_body)
  returning id into created_message_id;

  update public.direct_message_threads
  set updated_at = now()
  where id = requested_thread_id;

  perform private.mark_direct_message_read(requested_thread_id);
  return created_message_id;
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

  select first_name into sender_name
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

drop trigger if exists push_direct_message_after_insert on public.direct_messages;
create trigger push_direct_message_after_insert
after insert on public.direct_messages
for each row execute function private.push_direct_message();

create or replace function public.start_direct_message(requested_other_id uuid)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select private.start_direct_message(requested_other_id) $$;

create or replace function public.list_direct_message_threads()
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
security invoker
set search_path = ''
as $$ select * from private.list_direct_message_threads() $$;

create or replace function public.list_direct_messages(requested_thread_id uuid)
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
as $$ select * from private.list_direct_messages(requested_thread_id) $$;

create or replace function public.mark_direct_message_read(requested_thread_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.mark_direct_message_read(requested_thread_id) $$;

create or replace function public.send_direct_message(
  requested_thread_id uuid,
  requested_body text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select private.send_direct_message(requested_thread_id, requested_body) $$;

revoke all on function private.can_direct_message(uuid, uuid)
from public, anon, authenticated;
revoke all on function private.start_direct_message(uuid)
from public, anon;
revoke all on function private.list_direct_message_threads()
from public, anon;
revoke all on function private.list_direct_messages(uuid)
from public, anon;
revoke all on function private.mark_direct_message_read(uuid)
from public, anon;
revoke all on function private.send_direct_message(uuid, text)
from public, anon;
revoke all on function private.push_direct_message()
from public, anon, authenticated;

grant execute on function private.start_direct_message(uuid) to authenticated;
grant execute on function private.list_direct_message_threads() to authenticated;
grant execute on function private.list_direct_messages(uuid) to authenticated;
grant execute on function private.mark_direct_message_read(uuid) to authenticated;
grant execute on function private.send_direct_message(uuid, text) to authenticated;

revoke all on function public.start_direct_message(uuid) from public, anon;
revoke all on function public.list_direct_message_threads() from public, anon;
revoke all on function public.list_direct_messages(uuid) from public, anon;
revoke all on function public.mark_direct_message_read(uuid) from public, anon;
revoke all on function public.send_direct_message(uuid, text) from public, anon;

grant execute on function public.start_direct_message(uuid) to authenticated;
grant execute on function public.list_direct_message_threads() to authenticated;
grant execute on function public.list_direct_messages(uuid) to authenticated;
grant execute on function public.mark_direct_message_read(uuid) to authenticated;
grant execute on function public.send_direct_message(uuid, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'direct_messages'
    )
  then
    alter publication supabase_realtime add table public.direct_messages;
  end if;
end
$$;
