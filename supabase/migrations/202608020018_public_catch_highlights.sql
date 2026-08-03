-- Opt-in public photo highlights for completed public Catches.
-- Albums and new uploads remain private by default. Public visibility is
-- limited to signed-in Catch members, photos only, and public meeting places.

alter table public.catch_media
  add column if not exists visibility text not null default 'private',
  add column if not exists public_at timestamptz,
  add column if not exists consent_attested_at timestamptz,
  add column if not exists moderation_status text not null default 'visible';

alter table public.catch_media
  drop constraint if exists catch_media_visibility_check,
  add constraint catch_media_visibility_check
    check (visibility in ('private', 'public')),
  drop constraint if exists catch_media_moderation_status_check,
  add constraint catch_media_moderation_status_check
    check (moderation_status in ('visible', 'hidden')),
  drop constraint if exists catch_media_public_photo_check,
  add constraint catch_media_public_photo_check
    check (
      visibility = 'private'
      or (
        media_type = 'photo'
        and public_at is not null
        and consent_attested_at is not null
      )
    );

create index if not exists catch_media_public_feed_idx
on public.catch_media (public_at desc)
where visibility = 'public' and moderation_status = 'visible';

create table if not exists public.catch_highlight_credits (
  catch_id uuid not null references public.catches(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  opted_in_at timestamptz not null default now(),
  primary key (catch_id, user_id)
);

create table if not exists public.catch_media_reports (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.catch_media(id) on delete cascade,
  reporter_id uuid not null references public.profiles(user_id) on delete cascade,
  category text not null check (
    category in ('privacy_or_permission', 'inappropriate', 'other')
  ),
  detail text check (char_length(detail) <= 1000),
  created_at timestamptz not null default now(),
  unique (media_id, reporter_id)
);

alter table public.catch_highlight_credits enable row level security;
alter table public.catch_media_reports enable row level security;

drop policy if exists "members manage their own public Catch credit"
on public.catch_highlight_credits;
create policy "members manage their own public Catch credit"
on public.catch_highlight_credits for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "reporters read their own Catch media reports"
on public.catch_media_reports;
create policy "reporters read their own Catch media reports"
on public.catch_media_reports for select to authenticated
using (reporter_id = (select auth.uid()));

create or replace function private.is_public_catch_highlight_eligible(
  requested_catch_id uuid
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
      and target.visibility = 'public'
      and coalesce(target.metadata ->> 'location_type', 'catalog')
        in ('catalog', 'custom_public')
  );
$$;

drop policy if exists "Catch members can read public highlight rows"
on public.catch_media;
create policy "Catch members can read public highlight rows"
on public.catch_media for select to authenticated
using (
  media_type = 'photo'
  and visibility = 'public'
  and moderation_status = 'visible'
  and private.is_public_catch_highlight_eligible(catch_id)
);

drop policy if exists "Catch members can read public highlight objects"
on storage.objects;
create policy "Catch members can read public highlight objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'catch-memories'
  and exists (
    select 1
    from public.catch_media memory
    where memory.storage_path = storage.objects.name
      and memory.media_type = 'photo'
      and memory.visibility = 'public'
      and memory.moderation_status = 'visible'
      and private.is_public_catch_highlight_eligible(memory.catch_id)
  )
);

create or replace function private.set_catch_memory_public(
  requested_memory_id uuid,
  requested_public boolean,
  permission_attested boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  memory public.catch_media%rowtype;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select * into memory
  from public.catch_media
  where id = requested_memory_id
  for update;

  if not found then
    raise exception 'Catch memory not found';
  end if;
  if memory.uploader_id <> caller_id then
    raise exception 'Only the uploader can change this photo';
  end if;

  if not requested_public then
    update public.catch_media
    set visibility = 'private', public_at = null
    where id = memory.id;
    return;
  end if;

  if memory.media_type <> 'photo' then
    raise exception 'Videos remain private';
  end if;
  if memory.moderation_status <> 'visible' then
    raise exception 'This photo is hidden pending review';
  end if;
  if not permission_attested then
    raise exception 'Confirm that you have permission from everyone recognizable';
  end if;
  if not private.is_public_catch_highlight_eligible(memory.catch_id) then
    raise exception 'Only completed public Catches at public places can share highlights';
  end if;

  update public.catch_media
  set
    visibility = 'public',
    public_at = coalesce(public_at, now()),
    consent_attested_at = now()
  where id = memory.id;

  insert into public.catch_highlight_credits (catch_id, user_id, opted_in_at)
  values (memory.catch_id, caller_id, now())
  on conflict (catch_id, user_id) do update set opted_in_at = excluded.opted_in_at;
end;
$$;

create or replace function public.set_catch_memory_public(
  requested_memory_id uuid,
  requested_public boolean,
  permission_attested boolean default false
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_catch_memory_public(
    requested_memory_id,
    requested_public,
    permission_attested
  );
$$;

create or replace function private.set_catch_highlight_credit(
  requested_catch_id uuid,
  requested_visible boolean
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
  if not private.can_access_catch_memories(requested_catch_id, caller_id) then
    raise exception 'Only this completed Catch crew can manage public credit';
  end if;
  if not private.is_public_catch_highlight_eligible(requested_catch_id) then
    raise exception 'This Catch is not eligible for public highlights';
  end if;

  if requested_visible then
    insert into public.catch_highlight_credits (catch_id, user_id, opted_in_at)
    values (requested_catch_id, caller_id, now())
    on conflict (catch_id, user_id) do update set opted_in_at = excluded.opted_in_at;
  else
    delete from public.catch_highlight_credits
    where catch_id = requested_catch_id and user_id = caller_id;
  end if;
end;
$$;

create or replace function public.set_catch_highlight_credit(
  requested_catch_id uuid,
  requested_visible boolean
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_catch_highlight_credit(requested_catch_id, requested_visible);
$$;

create or replace function private.report_public_catch_memory(
  requested_memory_id uuid,
  requested_category text,
  requested_detail text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  memory public.catch_media%rowtype;
  normalized_category text := trim(requested_category);
  normalized_detail text := nullif(trim(coalesce(requested_detail, '')), '');
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if normalized_category not in ('privacy_or_permission', 'inappropriate', 'other') then
    raise exception 'Choose a valid report reason';
  end if;
  if normalized_detail is not null and char_length(normalized_detail) > 1000 then
    raise exception 'Report detail must be 1000 characters or fewer';
  end if;

  select * into memory
  from public.catch_media
  where id = requested_memory_id
    and visibility = 'public'
    and moderation_status = 'visible'
  for update;

  if not found then
    raise exception 'Public photo not found';
  end if;
  if memory.uploader_id = caller_id then
    raise exception 'Make your own photo private instead';
  end if;

  insert into public.catch_media_reports (
    media_id,
    reporter_id,
    category,
    detail
  ) values (
    memory.id,
    caller_id,
    normalized_category,
    normalized_detail
  )
  on conflict (media_id, reporter_id) do nothing;

  update public.catch_media
  set moderation_status = 'hidden'
  where id = memory.id;
end;
$$;

create or replace function public.report_public_catch_memory(
  requested_memory_id uuid,
  requested_category text,
  requested_detail text default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.report_public_catch_memory(
    requested_memory_id,
    requested_category,
    requested_detail
  );
$$;

drop function if exists public.list_catch_memories(uuid);
drop function if exists private.list_catch_memories(uuid);

create function private.list_catch_memories(requested_catch_id uuid)
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
  visibility text,
  moderation_status text,
  consent_attested_at timestamptz,
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
    memory.visibility,
    memory.moderation_status,
    memory.consent_attested_at,
    memory.created_at
  from public.catch_media memory
  join public.profiles profile on profile.user_id = memory.uploader_id
  where memory.catch_id = requested_catch_id
  order by memory.created_at desc;
end;
$$;

create function public.list_catch_memories(requested_catch_id uuid)
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
  visibility text,
  moderation_status text,
  consent_attested_at timestamptz,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.list_catch_memories(requested_catch_id);
$$;

create or replace function private.list_public_catch_highlights(
  requested_limit integer default 20,
  requested_offset integer default 0
)
returns table (
  catch_id uuid,
  title text,
  starts_at timestamptz,
  venue_name text,
  activity_name text,
  activity_slug text,
  activity_emoji text,
  participant_names text[],
  photo_count bigint,
  media_ids uuid[],
  storage_paths text[]
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

  return query
  select
    target.id,
    target.title,
    target.starts_at,
    case
      when coalesce(target.metadata ->> 'location_type', 'catalog') = 'catalog'
        then coalesce(venue.name, target.area_label)
      else target.area_label
    end,
    coalesce(nullif(target.metadata ->> 'custom_activity_name', ''), activity.name),
    activity.slug,
    activity.emoji,
    coalesce(credits.names, array[]::text[]),
    media.photo_count,
    media.media_ids,
    media.storage_paths
  from public.catches target
  join public.activity_types activity on activity.id = target.activity_type_id
  left join public.venues venue on venue.id = target.venue_id
  cross join lateral (
    select
      count(*) as photo_count,
      array(
        select candidate.id
        from public.catch_media candidate
        where candidate.catch_id = target.id
          and candidate.media_type = 'photo'
          and candidate.visibility = 'public'
          and candidate.moderation_status = 'visible'
        order by candidate.public_at desc
        limit 3
      ) as media_ids,
      array(
        select candidate.storage_path
        from public.catch_media candidate
        where candidate.catch_id = target.id
          and candidate.media_type = 'photo'
          and candidate.visibility = 'public'
          and candidate.moderation_status = 'visible'
        order by candidate.public_at desc
        limit 3
      ) as storage_paths,
      max(candidate.public_at) as latest_public_at
    from public.catch_media candidate
    where candidate.catch_id = target.id
      and candidate.media_type = 'photo'
      and candidate.visibility = 'public'
      and candidate.moderation_status = 'visible'
  ) media
  left join lateral (
    select array_agg(
      private.member_display_name(profile.first_name, profile.last_initial)
      order by (credit.user_id = target.host_id) desc, credit.opted_in_at
    ) as names
    from public.catch_highlight_credits credit
    join public.profiles profile on profile.user_id = credit.user_id
    where credit.catch_id = target.id
  ) credits on true
  where private.is_public_catch_highlight_eligible(target.id)
    and media.photo_count > 0
    and not exists (
      select 1
      from public.blocks block
      where (
        block.blocker_id = caller_id
        and (
          block.blocked_id = target.host_id
          or exists (
            select 1 from public.catch_media blocked_memory
            where blocked_memory.catch_id = target.id
              and blocked_memory.uploader_id = block.blocked_id
              and blocked_memory.visibility = 'public'
              and blocked_memory.moderation_status = 'visible'
          )
          or exists (
            select 1 from public.catch_highlight_credits blocked_credit
            where blocked_credit.catch_id = target.id
              and blocked_credit.user_id = block.blocked_id
          )
        )
      ) or (
        block.blocked_id = caller_id
        and (
          block.blocker_id = target.host_id
          or exists (
            select 1 from public.catch_media blocking_memory
            where blocking_memory.catch_id = target.id
              and blocking_memory.uploader_id = block.blocker_id
              and blocking_memory.visibility = 'public'
              and blocking_memory.moderation_status = 'visible'
          )
          or exists (
            select 1 from public.catch_highlight_credits blocking_credit
            where blocking_credit.catch_id = target.id
              and blocking_credit.user_id = block.blocker_id
          )
        )
      )
    )
  order by media.latest_public_at desc
  limit least(greatest(coalesce(requested_limit, 20), 1), 50)
  offset greatest(coalesce(requested_offset, 0), 0);
end;
$$;

create or replace function public.list_public_catch_highlights(
  requested_limit integer default 20,
  requested_offset integer default 0
)
returns table (
  catch_id uuid,
  title text,
  starts_at timestamptz,
  venue_name text,
  activity_name text,
  activity_slug text,
  activity_emoji text,
  participant_names text[],
  photo_count bigint,
  media_ids uuid[],
  storage_paths text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.list_public_catch_highlights(
    requested_limit,
    requested_offset
  );
$$;

revoke all on public.catch_highlight_credits, public.catch_media_reports from anon;
grant select on public.catch_highlight_credits to authenticated;
grant select on public.catch_media_reports to authenticated;

revoke all on function public.set_catch_memory_public(uuid, boolean, boolean)
from public, anon;
grant execute on function public.set_catch_memory_public(uuid, boolean, boolean)
to authenticated;
revoke all on function public.set_catch_highlight_credit(uuid, boolean)
from public, anon;
grant execute on function public.set_catch_highlight_credit(uuid, boolean)
to authenticated;
revoke all on function public.report_public_catch_memory(uuid, text, text)
from public, anon;
grant execute on function public.report_public_catch_memory(uuid, text, text)
to authenticated;
revoke all on function public.list_public_catch_highlights(integer, integer)
from public, anon;
grant execute on function public.list_public_catch_highlights(integer, integer)
to authenticated;
revoke all on function public.list_catch_memories(uuid) from public, anon;
grant execute on function public.list_catch_memories(uuid) to authenticated;

grant all privileges on public.catch_highlight_credits, public.catch_media_reports
to service_role;

comment on table public.catch_highlight_credits is
'Per-Catch opt-in for displaying a participant name in signed-in community highlights.';
comment on table public.catch_media_reports is
'Reports immediately hide a public Catch photo pending moderator review.';
