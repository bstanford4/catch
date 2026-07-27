-- Protected private locations and real join-request decisions.
--
-- Exact private meeting details are encrypted with pgcrypto. The symmetric key
-- is generated inside Supabase Vault and never sent to the client. Public RPC
-- wrappers call security-definer functions in the unexposed private schema.

create extension if not exists supabase_vault cascade;
create schema if not exists private;

do $$
begin
  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'catch_private_location_key'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'catch_private_location_key',
      'Application-level encryption key for Catch private meeting locations'
    );
  end if;
end
$$;

create or replace function private.catch_location_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'catch_private_location_key'
  order by created_at desc
  limit 1
$$;

create or replace function private.users_blocked(first_user uuid, second_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.blocks
    where (blocker_id = first_user and blocked_id = second_user)
       or (blocker_id = second_user and blocked_id = first_user)
  )
$$;

drop policy if exists "authenticated discover public catches" on public.catches;
create policy "authenticated discover public catches"
on public.catches for select to authenticated
using (
  visibility = 'public'
  and status in ('open', 'full')
  and starts_at > now()
  and host_id <> (select auth.uid())
  and not private.users_blocked(host_id, (select auth.uid()))
  and (
    minimum_age = 18
    or exists (
      select 1
      from public.profiles
      where user_id = (select auth.uid())
        and age_21_affirmed_at is not null
    )
  )
);

drop policy if exists "requesters read own join requests" on public.join_requests;
create policy "requesters read own join requests"
on public.join_requests for select to authenticated
using (requester_id = (select auth.uid()));

drop policy if exists "hosts read catch join requests" on public.join_requests;
create policy "hosts read catch join requests"
on public.join_requests for select to authenticated
using (
  catch_id in (
    select id
    from public.catches
    where host_id = (select auth.uid())
  )
);

drop policy if exists "participants read own membership" on public.catch_participants;
create policy "participants read own membership"
on public.catch_participants for select to authenticated
using (user_id = (select auth.uid()));

create or replace function private.set_private_catch_location(
  requested_catch_id uuid,
  place_name text,
  exact_address text,
  arrival_notes text default null,
  latitude double precision default null,
  longitude double precision default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  payload jsonb;
  encryption_key text;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.catches
    where id = requested_catch_id
      and host_id = caller_id
  ) then
    raise exception 'Only the Catch host can set its private location';
  end if;

  if place_name is null or char_length(trim(place_name)) not between 1 and 100 then
    raise exception 'Private place name must be between 1 and 100 characters';
  end if;
  if exact_address is null or char_length(trim(exact_address)) not between 3 and 300 then
    raise exception 'Exact address must be between 3 and 300 characters';
  end if;
  if arrival_notes is not null and char_length(arrival_notes) > 500 then
    raise exception 'Arrival notes must be 500 characters or fewer';
  end if;
  if (latitude is null) <> (longitude is null) then
    raise exception 'Latitude and longitude must be supplied together';
  end if;
  if latitude is not null and (latitude < -90 or latitude > 90) then
    raise exception 'Latitude is out of range';
  end if;
  if longitude is not null and (longitude < -180 or longitude > 180) then
    raise exception 'Longitude is out of range';
  end if;

  encryption_key := private.catch_location_key();
  if encryption_key is null then
    raise exception 'Private location encryption key is unavailable';
  end if;

  payload := jsonb_build_object(
    'place_name', trim(place_name),
    'exact_address', trim(exact_address),
    'arrival_notes', nullif(trim(coalesce(arrival_notes, '')), ''),
    'latitude', latitude,
    'longitude', longitude
  );

  insert into public.private_location_secrets (
    catch_id,
    encrypted_instructions,
    encryption_key_version,
    updated_at
  )
  values (
    requested_catch_id,
    extensions.pgp_sym_encrypt(
      payload::text,
      encryption_key,
      'cipher-algo=aes256, compress-algo=1'
    ),
    1,
    now()
  )
  on conflict (catch_id) do update set
    encrypted_instructions = excluded.encrypted_instructions,
    encryption_key_version = excluded.encryption_key_version,
    updated_at = excluded.updated_at;

  update public.catches
  set
    approval_required = true,
    venue_id = null,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('location_type', 'private'),
    updated_at = now()
  where id = requested_catch_id;
end
$$;

create or replace function private.delete_private_catch_location(requested_catch_id uuid)
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
  if not exists (
    select 1
    from public.catches
    where id = requested_catch_id
      and host_id = caller_id
  ) then
    raise exception 'Only the Catch host can remove its private location';
  end if;
  delete from public.private_location_secrets where catch_id = requested_catch_id;
end
$$;

create or replace function private.get_private_catch_location(requested_catch_id uuid)
returns table (
  place_name text,
  exact_address text,
  arrival_notes text,
  latitude double precision,
  longitude double precision
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  payload jsonb;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  if not (
    exists (
      select 1
      from public.catches
      where id = requested_catch_id
        and host_id = caller_id
    )
    or exists (
      select 1
      from public.catch_participants
      where catch_id = requested_catch_id
        and user_id = caller_id
        and status in ('approved', 'attended')
    )
  ) then
    raise exception 'Exact location is available only to the host and approved participants';
  end if;

  select extensions.pgp_sym_decrypt(
    secrets.encrypted_instructions,
    private.catch_location_key()
  )::jsonb
  into payload
  from public.private_location_secrets secrets
  where secrets.catch_id = requested_catch_id;

  if payload is null then
    return;
  end if;

  return query
  select
    payload->>'place_name',
    payload->>'exact_address',
    payload->>'arrival_notes',
    (payload->>'latitude')::double precision,
    (payload->>'longitude')::double precision;
end
$$;

create or replace function private.request_to_join(
  requested_catch_id uuid,
  request_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_catch public.catches%rowtype;
  request_id uuid;
  approved_count integer;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if request_message is not null and char_length(request_message) > 500 then
    raise exception 'Join message must be 500 characters or fewer';
  end if;

  select *
  into target_catch
  from public.catches
  where id = requested_catch_id
    and visibility = 'public'
    and status = 'open'
    and starts_at > now();

  if not found then
    raise exception 'This Catch is no longer accepting requests';
  end if;
  if target_catch.host_id = caller_id then
    raise exception 'Hosts are already part of their own Catch';
  end if;
  if private.users_blocked(target_catch.host_id, caller_id) then
    raise exception 'This Catch is unavailable';
  end if;
  if target_catch.minimum_age = 21 and not exists (
    select 1
    from public.profiles
    where user_id = caller_id
      and age_21_affirmed_at is not null
  ) then
    raise exception 'This Catch is limited to members who affirmed they are 21+';
  end if;

  if not target_catch.approval_required
     and coalesce(target_catch.metadata->>'location_type', '') <> 'private' then
    select count(*) into approved_count
    from public.catch_participants
    where catch_id = target_catch.id
      and status in ('approved', 'attended');
    if approved_count >= target_catch.capacity - 1 then
      raise exception 'This Catch is already full';
    end if;

    insert into public.join_requests (
      catch_id,
      requester_id,
      message,
      status,
      decided_at
    )
    values (
      requested_catch_id,
      caller_id,
      nullif(trim(coalesce(request_message, '')), ''),
      'approved',
      now()
    )
    on conflict (catch_id, requester_id) do update set
      message = excluded.message,
      status = 'approved',
      decided_by = null,
      decided_at = now(),
      created_at = now()
    where public.join_requests.status in ('requested', 'declined', 'withdrawn')
    returning id into request_id;

    if request_id is null then
      select id into request_id
      from public.join_requests
      where catch_id = requested_catch_id
        and requester_id = caller_id;
    end if;

    insert into public.catch_participants (
      catch_id,
      user_id,
      role,
      status,
      joined_at,
      updated_at
    )
    values (
      target_catch.id,
      caller_id,
      'member',
      'approved',
      now(),
      now()
    )
    on conflict (catch_id, user_id) do update set
      status = 'approved',
      joined_at = coalesce(public.catch_participants.joined_at, now()),
      updated_at = now();

    if approved_count + 1 >= target_catch.capacity - 1 then
      update public.catches
      set status = 'full', updated_at = now()
      where id = target_catch.id;
    end if;
    return request_id;
  end if;

  insert into public.join_requests (
    catch_id,
    requester_id,
    message,
    status
  )
  values (
    requested_catch_id,
    caller_id,
    nullif(trim(coalesce(request_message, '')), ''),
    'requested'
  )
  on conflict (catch_id, requester_id) do update set
    message = excluded.message,
    status = 'requested',
    decided_by = null,
    decided_at = null,
    created_at = now()
  where public.join_requests.status in ('declined', 'withdrawn')
  returning id into request_id;

  if request_id is null then
    select id into request_id
    from public.join_requests
    where catch_id = requested_catch_id
      and requester_id = caller_id;
  end if;
  return request_id;
end
$$;

create or replace function private.decide_join_request(
  requested_join_request_id uuid,
  approve boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  request_row public.join_requests%rowtype;
  target_catch public.catches%rowtype;
  approved_count integer;
  next_status public.participant_status;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select * into request_row
  from public.join_requests
  where id = requested_join_request_id
  for update;
  if not found then
    raise exception 'Join request not found';
  end if;

  select * into target_catch
  from public.catches
  where id = request_row.catch_id
    and host_id = caller_id
  for update;
  if not found then
    raise exception 'Only the Catch host can decide this request';
  end if;
  if request_row.status <> 'requested' then
    raise exception 'This request has already been decided';
  end if;

  if approve then
    if target_catch.status not in ('open', 'full') or target_catch.starts_at <= now() then
      raise exception 'This Catch is no longer accepting participants';
    end if;
    select count(*) into approved_count
    from public.catch_participants
    where catch_id = target_catch.id
      and status in ('approved', 'attended');
    if approved_count >= target_catch.capacity - 1 then
      raise exception 'This Catch is already full';
    end if;
    next_status := 'approved';

    insert into public.catch_participants (
      catch_id,
      user_id,
      role,
      status,
      joined_at,
      updated_at
    )
    values (
      target_catch.id,
      request_row.requester_id,
      'member',
      'approved',
      now(),
      now()
    )
    on conflict (catch_id, user_id) do update set
      status = 'approved',
      joined_at = coalesce(public.catch_participants.joined_at, now()),
      updated_at = now();

    if approved_count + 1 >= target_catch.capacity - 1 then
      update public.catches
      set status = 'full', updated_at = now()
      where id = target_catch.id;
    end if;
  else
    next_status := 'declined';
  end if;

  update public.join_requests
  set
    status = next_status,
    decided_by = caller_id,
    decided_at = now()
  where id = request_row.id;

  return next_status::text;
end
$$;

create or replace function private.withdraw_join_request(requested_join_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  update public.join_requests
  set status = 'withdrawn', decided_at = now()
  where id = requested_join_request_id
    and requester_id = caller_id
    and status = 'requested';
  if not found then
    raise exception 'Pending join request not found';
  end if;
end
$$;

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
    profiles.first_name,
    requests.message,
    requests.status,
    requests.created_at
  from public.join_requests requests
  join public.profiles profiles on profiles.user_id = requests.requester_id
  where requests.catch_id = requested_catch_id
  order by requests.created_at desc;
end
$$;

create or replace function public.set_private_catch_location(
  requested_catch_id uuid,
  place_name text,
  exact_address text,
  arrival_notes text default null,
  latitude double precision default null,
  longitude double precision default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_private_catch_location(
    requested_catch_id,
    place_name,
    exact_address,
    arrival_notes,
    latitude,
    longitude
  )
$$;

create or replace function public.delete_private_catch_location(requested_catch_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.delete_private_catch_location(requested_catch_id)
$$;

create or replace function public.get_private_catch_location(requested_catch_id uuid)
returns table (
  place_name text,
  exact_address text,
  arrival_notes text,
  latitude double precision,
  longitude double precision
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.get_private_catch_location(requested_catch_id)
$$;

create or replace function public.request_to_join(
  requested_catch_id uuid,
  request_message text default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.request_to_join(requested_catch_id, request_message)
$$;

create or replace function public.decide_join_request(
  requested_join_request_id uuid,
  approve boolean
)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.decide_join_request(requested_join_request_id, approve)
$$;

create or replace function public.withdraw_join_request(requested_join_request_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.withdraw_join_request(requested_join_request_id)
$$;

create or replace function public.list_host_join_requests(requested_catch_id uuid)
returns table (
  id uuid,
  requester_id uuid,
  requester_first_name text,
  message text,
  status public.participant_status,
  created_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.list_host_join_requests(requested_catch_id)
$$;

revoke all on function private.catch_location_key() from public, anon, authenticated;
revoke all on function private.users_blocked(uuid, uuid) from public, anon;
revoke all on function private.set_private_catch_location(uuid, text, text, text, double precision, double precision) from public, anon;
revoke all on function private.delete_private_catch_location(uuid) from public, anon;
revoke all on function private.get_private_catch_location(uuid) from public, anon;
revoke all on function private.request_to_join(uuid, text) from public, anon;
revoke all on function private.decide_join_request(uuid, boolean) from public, anon;
revoke all on function private.withdraw_join_request(uuid) from public, anon;
revoke all on function private.list_host_join_requests(uuid) from public, anon;

grant usage on schema private to authenticated;
grant execute on function private.users_blocked(uuid, uuid) to authenticated;
grant execute on function private.set_private_catch_location(uuid, text, text, text, double precision, double precision) to authenticated;
grant execute on function private.delete_private_catch_location(uuid) to authenticated;
grant execute on function private.get_private_catch_location(uuid) to authenticated;
grant execute on function private.request_to_join(uuid, text) to authenticated;
grant execute on function private.decide_join_request(uuid, boolean) to authenticated;
grant execute on function private.withdraw_join_request(uuid) to authenticated;
grant execute on function private.list_host_join_requests(uuid) to authenticated;

revoke all on function public.set_private_catch_location(uuid, text, text, text, double precision, double precision) from public, anon;
revoke all on function public.delete_private_catch_location(uuid) from public, anon;
revoke all on function public.get_private_catch_location(uuid) from public, anon;
revoke all on function public.request_to_join(uuid, text) from public, anon;
revoke all on function public.decide_join_request(uuid, boolean) from public, anon;
revoke all on function public.withdraw_join_request(uuid) from public, anon;
revoke all on function public.list_host_join_requests(uuid) from public, anon;

grant execute on function public.set_private_catch_location(uuid, text, text, text, double precision, double precision) to authenticated;
grant execute on function public.delete_private_catch_location(uuid) to authenticated;
grant execute on function public.get_private_catch_location(uuid) to authenticated;
grant execute on function public.request_to_join(uuid, text) to authenticated;
grant execute on function public.decide_join_request(uuid, boolean) to authenticated;
grant execute on function public.withdraw_join_request(uuid) to authenticated;
grant execute on function public.list_host_join_requests(uuid) to authenticated;
