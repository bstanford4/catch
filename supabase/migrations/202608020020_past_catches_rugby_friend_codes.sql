-- Retroactive Catch logging, participant confirmation, Rugby, and an
-- unambiguous Catch Mate invite-code function.

insert into public.activity_types (slug, name, emoji, sort_order, active)
values ('rugby', 'Rugby', U&'\+01F3C9', 45, true)
on conflict (slug) do update set
  name = excluded.name,
  emoji = excluded.emoji,
  sort_order = excluded.sort_order,
  active = true;

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

  delete from public.catch_mate_invites stale_invite
  where stale_invite.inviter_id = caller_id
    and (stale_invite.expires_at <= now() or stale_invite.redeemed_at is not null);

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
        -- Generate another code in the extraordinarily unlikely event of a collision.
      end;
    end loop;
  end if;

  return query select generated_code, generated_expiry;
end;
$$;

create table if not exists public.past_catch_confirmations (
  id uuid primary key default gen_random_uuid(),
  catch_id uuid not null references public.catches(id) on delete cascade,
  inviter_id uuid not null references public.profiles(user_id) on delete cascade,
  invitee_id uuid not null references public.profiles(user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (catch_id, invitee_id),
  check (inviter_id <> invitee_id)
);

create index if not exists past_catch_confirmations_invitee_idx
on public.past_catch_confirmations (invitee_id, status, created_at desc);

alter table public.past_catch_confirmations enable row level security;
revoke all on public.past_catch_confirmations from public, anon, authenticated;
grant all privileges on public.past_catch_confirmations to service_role;

create or replace function private.log_past_catch(
  requested_activity_type_id uuid,
  requested_title text,
  requested_starts_at timestamptz,
  requested_duration_minutes integer,
  requested_timezone text,
  requested_location_type text,
  requested_venue_name text,
  requested_area_label text,
  requested_invitee_ids uuid[] default '{}',
  requested_guest_note text default null,
  requested_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  created_catch_id uuid := extensions.gen_random_uuid();
  invitee_ids uuid[] := coalesce(requested_invitee_ids, array[]::uuid[]);
  cleaned_title text := trim(coalesce(requested_title, ''));
  cleaned_area text := trim(coalesce(requested_area_label, ''));
  cleaned_venue text := nullif(trim(coalesce(requested_venue_name, '')), '');
  cleaned_guest_note text := nullif(trim(coalesce(requested_guest_note, '')), '');
  cleaned_description text := nullif(trim(coalesce(requested_description, '')), '');
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if not exists (select 1 from public.profiles where user_id = caller_id) then
    raise exception 'Complete your profile before logging a Catch';
  end if;
  if not exists (
    select 1 from public.activity_types
    where id = requested_activity_type_id and active
  ) then
    raise exception 'Choose an available activity';
  end if;
  if char_length(cleaned_title) not between 1 and 100 then
    raise exception 'Catch title must be between 1 and 100 characters';
  end if;
  if requested_starts_at is null
     or requested_starts_at + make_interval(mins => requested_duration_minutes) > now() then
    raise exception 'A past Catch must already be over';
  end if;
  if requested_duration_minutes is null or requested_duration_minutes not between 15 and 480 then
    raise exception 'Duration must be between 15 and 480 minutes';
  end if;
  if trim(coalesce(requested_timezone, '')) = '' then
    raise exception 'Timezone is required';
  end if;
  if requested_location_type not in ('custom_public', 'private') then
    raise exception 'Choose a public place or a private/informal location';
  end if;
  if char_length(cleaned_area) not between 1 and 100 then
    raise exception 'Enter a broad area between 1 and 100 characters';
  end if;
  if requested_location_type = 'custom_public' and cleaned_venue is null then
    raise exception 'Enter the public place name';
  end if;
  if cleaned_venue is not null and char_length(cleaned_venue) > 120 then
    raise exception 'Place name is too long';
  end if;
  if cleaned_guest_note is not null and char_length(cleaned_guest_note) > 200 then
    raise exception 'Private guest note is too long';
  end if;
  if cleaned_description is not null and char_length(cleaned_description) > 1000 then
    raise exception 'Catch note is too long';
  end if;
  if exists (select 1 from unnest(invitee_ids) invited_id where invited_id is null) then
    raise exception 'Invalid Catch Mate selection';
  end if;
  if cardinality(invitee_ids) <> (
    select count(distinct invited_id)::integer from unnest(invitee_ids) invited_id
  ) then
    raise exception 'A Catch Mate was selected more than once';
  end if;
  if caller_id = any(invitee_ids) then
    raise exception 'You are already the host of this Catch';
  end if;
  if exists (
    select 1
    from unnest(invitee_ids) invited_id
    where not exists (
      select 1 from public.catch_mates mate
      where mate.user_id = caller_id and mate.mate_id = invited_id
    ) or private.users_blocked(caller_id, invited_id)
  ) then
    raise exception 'Only current Catch Mates can be asked to confirm a past Catch';
  end if;

  insert into public.catches (
    id, host_id, kind, activity_type_id, title, description, starts_at,
    duration_minutes, timezone, area_label, capacity, approval_required,
    visibility, minimum_age, metadata, status
  ) values (
    created_catch_id,
    caller_id,
    'scheduled',
    requested_activity_type_id,
    cleaned_title,
    cleaned_description,
    requested_starts_at,
    requested_duration_minutes,
    trim(requested_timezone),
    cleaned_area,
    greatest(2, cardinality(invitee_ids) + 1),
    false,
    case when requested_location_type = 'custom_public' then 'public' else 'invite_only' end,
    18,
    jsonb_strip_nulls(jsonb_build_object(
      'source', 'retroactive_log',
      'location_type', requested_location_type,
      'custom_venue_name', cleaned_venue,
      'custom_venue_area', cleaned_area,
      'guest_note', cleaned_guest_note
    )),
    'completed'
  );

  insert into public.catch_status_history (
    catch_id, from_status, to_status, actor_id, reason_code
  ) values (
    created_catch_id, null, 'completed', caller_id, 'retroactive_host_log'
  );

  insert into public.past_catch_confirmations (catch_id, inviter_id, invitee_id)
  select created_catch_id, caller_id, invited_id
  from unnest(invitee_ids) invited_id;

  return created_catch_id;
end;
$$;

create or replace function private.list_my_past_catch_confirmations()
returns table (
  confirmation_id uuid,
  catch_id uuid,
  title text,
  starts_at timestamptz,
  duration_minutes integer,
  location_label text,
  activity_name text,
  activity_slug text,
  activity_emoji text,
  host_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    confirmation.id,
    target.id,
    target.title,
    target.starts_at,
    target.duration_minutes,
    case coalesce(target.metadata ->> 'location_type', 'private')
      when 'custom_public' then coalesce(nullif(target.metadata ->> 'custom_venue_name', ''), target.area_label)
      else 'Private or informal meetup · ' || target.area_label
    end,
    activity.name,
    activity.slug,
    activity.emoji,
    private.member_display_name(host_profile.first_name, host_profile.last_initial)
  from public.past_catch_confirmations confirmation
  join public.catches target on target.id = confirmation.catch_id
  join public.activity_types activity on activity.id = target.activity_type_id
  join public.profiles host_profile on host_profile.user_id = confirmation.inviter_id
  where confirmation.invitee_id = auth.uid()
    and confirmation.status = 'pending'
    and not private.users_blocked(confirmation.inviter_id, confirmation.invitee_id)
  order by target.starts_at desc;
$$;

create or replace function private.respond_to_past_catch_confirmation(
  requested_confirmation_id uuid,
  approve boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  confirmation public.past_catch_confirmations%rowtype;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select * into confirmation
  from public.past_catch_confirmations
  where id = requested_confirmation_id
  for update;

  if not found or confirmation.invitee_id <> caller_id then
    raise exception 'Past Catch confirmation not found';
  end if;
  if confirmation.status <> 'pending' then
    raise exception 'This confirmation has already been answered';
  end if;
  if private.users_blocked(confirmation.inviter_id, caller_id) then
    raise exception 'This confirmation is no longer available';
  end if;

  update public.past_catch_confirmations
  set status = case when approve then 'accepted' else 'declined' end,
      responded_at = now()
  where id = confirmation.id;

  if approve then
    insert into public.catch_participants (
      catch_id, user_id, role, status, joined_at, updated_at
    ) values (
      confirmation.catch_id, caller_id, 'member', 'attended', now(), now()
    )
    on conflict (catch_id, user_id) do update set
      status = 'attended',
      joined_at = coalesce(public.catch_participants.joined_at, now()),
      updated_at = now();
  end if;

  return confirmation.catch_id;
end;
$$;

create or replace function public.log_past_catch(
  requested_activity_type_id uuid,
  requested_title text,
  requested_starts_at timestamptz,
  requested_duration_minutes integer,
  requested_timezone text,
  requested_location_type text,
  requested_venue_name text,
  requested_area_label text,
  requested_invitee_ids uuid[] default '{}',
  requested_guest_note text default null,
  requested_description text default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.log_past_catch(
    requested_activity_type_id,
    requested_title,
    requested_starts_at,
    requested_duration_minutes,
    requested_timezone,
    requested_location_type,
    requested_venue_name,
    requested_area_label,
    requested_invitee_ids,
    requested_guest_note,
    requested_description
  );
$$;

create or replace function public.list_my_past_catch_confirmations()
returns table (
  confirmation_id uuid,
  catch_id uuid,
  title text,
  starts_at timestamptz,
  duration_minutes integer,
  location_label text,
  activity_name text,
  activity_slug text,
  activity_emoji text,
  host_name text
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.list_my_past_catch_confirmations() $$;

create or replace function public.respond_to_past_catch_confirmation(
  requested_confirmation_id uuid,
  approve boolean
)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select private.respond_to_past_catch_confirmation(requested_confirmation_id, approve) $$;

revoke all on function private.log_past_catch(uuid, text, timestamptz, integer, text, text, text, text, uuid[], text, text) from public, anon;
revoke all on function private.list_my_past_catch_confirmations() from public, anon;
revoke all on function private.respond_to_past_catch_confirmation(uuid, boolean) from public, anon;
revoke all on function public.log_past_catch(uuid, text, timestamptz, integer, text, text, text, text, uuid[], text, text) from public, anon;
revoke all on function public.list_my_past_catch_confirmations() from public, anon;
revoke all on function public.respond_to_past_catch_confirmation(uuid, boolean) from public, anon;

grant execute on function private.log_past_catch(uuid, text, timestamptz, integer, text, text, text, text, uuid[], text, text) to authenticated;
grant execute on function private.list_my_past_catch_confirmations() to authenticated;
grant execute on function private.respond_to_past_catch_confirmation(uuid, boolean) to authenticated;
grant execute on function public.log_past_catch(uuid, text, timestamptz, integer, text, text, text, text, uuid[], text, text) to authenticated;
grant execute on function public.list_my_past_catch_confirmations() to authenticated;
grant execute on function public.respond_to_past_catch_confirmation(uuid, boolean) to authenticated;

comment on function public.log_past_catch(uuid, text, timestamptz, integer, text, text, text, text, uuid[], text, text) is
'Logs an already-completed Catch. It never enters discovery; invited Catch Mates must confirm attendance.';
