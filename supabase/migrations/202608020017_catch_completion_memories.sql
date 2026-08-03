-- Completed Catch history and private participant-only media albums.
-- Objects are stored at <catch-id>/<uploader-id>/<random-name> and remain
-- private. Approved crew members can revisit a completed Catch indefinitely.

create table if not exists public.catch_media (
  id uuid primary key default gen_random_uuid(),
  catch_id uuid not null references public.catches(id) on delete cascade,
  uploader_id uuid not null references public.profiles(user_id) on delete cascade,
  storage_path text not null unique,
  media_type text not null check (media_type in ('photo', 'video')),
  mime_type text not null,
  caption text check (char_length(caption) <= 280),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_seconds integer check (
    (media_type = 'photo' and duration_seconds is null)
    or (media_type = 'video' and duration_seconds between 1 and 60)
  ),
  created_at timestamptz not null default now()
);

create index if not exists catch_media_catch_created_idx
on public.catch_media (catch_id, created_at desc);

alter table public.catch_media enable row level security;

create or replace function private.can_access_catch_memories(
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
      and target.status = 'completed'
      and (
        target.host_id = requested_user_id
        or exists (
          select 1
          from public.catch_participants participant
          where participant.catch_id = target.id
            and participant.user_id = requested_user_id
            and participant.status in ('approved', 'attended')
        )
      )
  );
$$;

drop policy if exists "completed crew can read Catch memories" on public.catch_media;
create policy "completed crew can read Catch memories"
on public.catch_media for select to authenticated
using (private.can_access_catch_memories(catch_id, (select auth.uid())));

drop policy if exists "completed crew can add Catch memories" on public.catch_media;
create policy "completed crew can add Catch memories"
on public.catch_media for insert to authenticated
with check (
  uploader_id = (select auth.uid())
  and private.can_access_catch_memories(catch_id, (select auth.uid()))
);

drop policy if exists "uploaders can remove their Catch memories" on public.catch_media;
create policy "uploaders can remove their Catch memories"
on public.catch_media for delete to authenticated
using (uploader_id = (select auth.uid()));

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'catch-memories',
  'catch-memories',
  false,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "completed crew can read Catch memory objects" on storage.objects;
create policy "completed crew can read Catch memory objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'catch-memories'
  and (storage.foldername(name))[1]
    ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and private.can_access_catch_memories(
    ((storage.foldername(name))[1])::uuid,
    (select auth.uid())
  )
);

drop policy if exists "completed crew can upload Catch memory objects" on storage.objects;
create policy "completed crew can upload Catch memory objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'catch-memories'
  and (storage.foldername(name))[1]
    ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2] = (select auth.uid()::text)
  and private.can_access_catch_memories(
    ((storage.foldername(name))[1])::uuid,
    (select auth.uid())
  )
);

drop policy if exists "uploaders can remove Catch memory objects" on storage.objects;
create policy "uploaders can remove Catch memory objects"
on storage.objects for delete to authenticated
using (
  bucket_id = 'catch-memories'
  and (storage.foldername(name))[2] = (select auth.uid()::text)
);

create or replace function private.complete_catch(requested_catch_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target public.catches%rowtype;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select * into target
  from public.catches
  where id = requested_catch_id
  for update;

  if not found then
    raise exception 'Catch not found';
  end if;
  if target.host_id <> caller_id then
    raise exception 'Only the host can complete this Catch';
  end if;
  if target.status = 'completed' then
    return;
  end if;
  if target.status not in ('open', 'full', 'confirmed') then
    raise exception 'This Catch cannot be completed';
  end if;
  if target.starts_at + make_interval(mins => target.duration_minutes) > now() then
    raise exception 'Wait until the Catch is over before completing it';
  end if;

  update public.catches
  set status = 'completed', updated_at = now()
  where id = target.id;

  insert into public.catch_status_history (
    catch_id,
    from_status,
    to_status,
    actor_id,
    reason_code
  ) values (
    target.id,
    target.status,
    'completed',
    caller_id,
    'host_confirmed'
  );
end;
$$;

create or replace function public.complete_catch(requested_catch_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.complete_catch(requested_catch_id);
$$;

create or replace function private.list_catch_memories(requested_catch_id uuid)
returns table (
  id uuid,
  catch_id uuid,
  uploader_id uuid,
  uploader_name text,
  storage_path text,
  media_type text,
  mime_type text,
  caption text,
  width integer,
  height integer,
  duration_seconds integer,
  created_at timestamptz
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
  if not private.can_access_catch_memories(requested_catch_id, caller_id) then
    raise exception 'Catch memories are available only to the completed Catch crew';
  end if;

  return query
  select
    memory.id,
    memory.catch_id,
    memory.uploader_id,
    private.member_display_name(profile.first_name, profile.last_initial),
    memory.storage_path,
    memory.media_type,
    memory.mime_type,
    memory.caption,
    memory.width,
    memory.height,
    memory.duration_seconds,
    memory.created_at
  from public.catch_media memory
  join public.profiles profile on profile.user_id = memory.uploader_id
  where memory.catch_id = requested_catch_id
  order by memory.created_at desc;
end;
$$;

create or replace function public.list_catch_memories(requested_catch_id uuid)
returns table (
  id uuid,
  catch_id uuid,
  uploader_id uuid,
  uploader_name text,
  storage_path text,
  media_type text,
  mime_type text,
  caption text,
  width integer,
  height integer,
  duration_seconds integer,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.list_catch_memories(requested_catch_id);
$$;

revoke all on public.catch_media from anon;
grant select, insert, delete on public.catch_media to authenticated;

revoke all on function public.complete_catch(uuid) from public, anon;
grant execute on function public.complete_catch(uuid) to authenticated;
revoke all on function public.list_catch_memories(uuid) from public, anon;
grant execute on function public.list_catch_memories(uuid) to authenticated;

grant all privileges on public.catch_media to service_role;

comment on table public.catch_media is
'Private photos and short videos attached to a completed Catch. Access remains limited to its host and approved crew.';
