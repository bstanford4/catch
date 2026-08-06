-- Encrypted private locations for direct Catch proposals.
--
-- Pending proposals expose only a broad area. Exact details are encrypted with
-- the existing private-location key and copied into the accepted Catch only
-- after the recipient accepts.

alter table public.proposal_revisions
  add column if not exists location_type text,
  add column if not exists private_location_encrypted bytea;

update public.proposal_revisions
set location_type = case when venue_id is null then 'later' else 'catalog' end
where location_type is null;

alter table public.proposal_revisions
  alter column location_type set default 'later',
  alter column location_type set not null;

alter table public.proposal_revisions
  drop constraint if exists proposal_revisions_location_type_check,
  add constraint proposal_revisions_location_type_check
    check (location_type in ('later', 'catalog', 'private')),
  drop constraint if exists proposal_revisions_location_shape_check,
  add constraint proposal_revisions_location_shape_check
    check (
      (location_type = 'catalog' and venue_id is not null and private_location_encrypted is null)
      or (location_type = 'later' and venue_id is null and private_location_encrypted is null)
      or (location_type = 'private' and venue_id is null and private_location_encrypted is not null)
    );

drop function if exists public.create_direct_catch_proposal(
  uuid, uuid, timestamptz, integer, text, uuid, text
);
drop function if exists private.create_direct_catch_proposal(
  uuid, uuid, timestamptz, integer, text, uuid, text
);

create function private.create_direct_catch_proposal(
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
  requested_longitude double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  proposal_id uuid;
  clean_location_type text := lower(trim(coalesce(requested_location_type, 'later')));
  private_payload jsonb;
  encrypted_location bytea;
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
  if clean_location_type not in ('later', 'catalog', 'private') then
    raise exception 'Choose a valid meeting location';
  end if;
  if clean_location_type = 'catalog' then
    if requested_venue_id is null or not exists (
      select 1 from public.venues
      where id = requested_venue_id and is_public
    ) then
      raise exception 'Choose an available public venue';
    end if;
  elsif requested_venue_id is not null then
    raise exception 'Only public-venue proposals may include a venue';
  end if;

  if clean_location_type = 'private' then
    if requested_private_place_name is null
      or char_length(trim(requested_private_place_name)) not between 1 and 100 then
      raise exception 'Private place name must be between 1 and 100 characters';
    end if;
    if requested_exact_address is null
      or char_length(trim(requested_exact_address)) not between 3 and 300 then
      raise exception 'Exact address must be between 3 and 300 characters';
    end if;
    if requested_arrival_notes is not null and char_length(requested_arrival_notes) > 500 then
      raise exception 'Arrival notes must be 500 characters or fewer';
    end if;
    if (requested_latitude is null) <> (requested_longitude is null) then
      raise exception 'Latitude and longitude must be supplied together';
    end if;
    if requested_latitude is not null and (requested_latitude < -90 or requested_latitude > 90) then
      raise exception 'Latitude is out of range';
    end if;
    if requested_longitude is not null and (requested_longitude < -180 or requested_longitude > 180) then
      raise exception 'Longitude is out of range';
    end if;
    if private.catch_location_key() is null then
      raise exception 'Private location encryption key is unavailable';
    end if;

    private_payload := jsonb_build_object(
      'place_name', trim(requested_private_place_name),
      'exact_address', trim(requested_exact_address),
      'arrival_notes', nullif(trim(coalesce(requested_arrival_notes, '')), ''),
      'latitude', requested_latitude,
      'longitude', requested_longitude
    );
    encrypted_location := extensions.pgp_sym_encrypt(
      private_payload::text,
      private.catch_location_key(),
      'cipher-algo=aes256, compress-algo=1'
    );
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
    message,
    location_type,
    private_location_encrypted
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
    nullif(trim(coalesce(requested_message, '')), ''),
    clean_location_type,
    encrypted_location
  );

  return proposal_id;
end
$$;

drop function if exists public.list_direct_catch_proposals();
drop function if exists private.list_direct_catch_proposals();

create function private.list_direct_catch_proposals()
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
    revision.location_type,
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
  if revision_row.location_type = 'private'
    and revision_row.private_location_encrypted is null then
    raise exception 'The private meeting location is unavailable';
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
    revision_row.location_type = 'private',
    'unlisted',
    'Easygoing',
    18,
    jsonb_build_object(
      'host_first_name', sender_name,
      'location_type', revision_row.location_type,
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

  if revision_row.location_type = 'private' then
    insert into public.private_location_secrets (
      catch_id,
      encrypted_instructions,
      encryption_key_version,
      updated_at
    )
    values (
      created_catch_id,
      revision_row.private_location_encrypted,
      1,
      now()
    );
  end if;

  update public.catch_proposals
  set
    status = 'accepted',
    accepted_catch_id = created_catch_id,
    updated_at = now()
  where id = proposal_row.id;

  return created_catch_id;
end
$$;

create function public.create_direct_catch_proposal(
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
  requested_longitude double precision default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_direct_catch_proposal(
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
  )
$$;

create function public.list_direct_catch_proposals()
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
  created_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$ select * from private.list_direct_catch_proposals() $$;

revoke all on function private.create_direct_catch_proposal(
  uuid, uuid, timestamptz, integer, text, uuid, text, text, text, text, text,
  double precision, double precision
) from public, anon;
revoke all on function private.list_direct_catch_proposals() from public, anon;
revoke all on function public.create_direct_catch_proposal(
  uuid, uuid, timestamptz, integer, text, uuid, text, text, text, text, text,
  double precision, double precision
) from public, anon;
revoke all on function public.list_direct_catch_proposals() from public, anon;

grant execute on function private.create_direct_catch_proposal(
  uuid, uuid, timestamptz, integer, text, uuid, text, text, text, text, text,
  double precision, double precision
) to authenticated;
grant execute on function private.list_direct_catch_proposals() to authenticated;
grant execute on function public.create_direct_catch_proposal(
  uuid, uuid, timestamptz, integer, text, uuid, text, text, text, text, text,
  double precision, double precision
) to authenticated;
grant execute on function public.list_direct_catch_proposals() to authenticated;

comment on column public.proposal_revisions.private_location_encrypted is
'Encrypted exact meeting details for a pending private direct proposal. Never returned by proposal-list RPCs.';

comment on function public.create_direct_catch_proposal(
  uuid, uuid, timestamptz, integer, text, uuid, text, text, text, text, text,
  double precision, double precision
) is
'Creates a direct Catch Mate proposal. Private exact locations remain encrypted and unlock only after acceptance.';
