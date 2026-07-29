create schema if not exists extensions;
create schema if not exists gis;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema gis;

grant usage on schema gis to anon, authenticated, service_role;

create type public.catch_kind as enum ('now', 'scheduled');
create type public.catch_status as enum (
  'draft', 'open', 'full', 'confirmed', 'completed', 'canceled', 'disputed', 'expired'
);
create type public.participant_status as enum (
  'requested', 'approved', 'declined', 'withdrawn', 'attended', 'no_show', 'left'
);
create type public.proposal_status as enum (
  'pending', 'accepted', 'declined', 'countered', 'expired', 'withdrawn'
);
create type public.report_target as enum ('user', 'message', 'catch', 'venue');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 60),
  photo_path text,
  bio text check (char_length(bio) <= 500),
  area_label text not null,
  coarse_location gis.geography(point, 4326),
  age_18_affirmed_at timestamptz not null,
  age_21_affirmed_at timestamptz,
  preferred_radius_miles integer not null default 10 check (preferred_radius_miles between 1 and 100),
  athletic_rating_visible boolean not null default false,
  catch_card_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_coarse_location_gix on public.profiles using gist (coarse_location);

create table public.activity_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  emoji text,
  metadata_schema jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0
);

create table public.activity_subtypes (
  id uuid primary key default gen_random_uuid(),
  activity_type_id uuid not null references public.activity_types(id) on delete cascade,
  slug text not null,
  name text not null,
  active boolean not null default true,
  unique (activity_type_id, slug)
);

create table public.user_activity_preferences (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  activity_type_id uuid not null references public.activity_types(id),
  subtype_ids uuid[] not null default '{}',
  intensity text,
  primary key (user_id, activity_type_id)
);

create table public.availability_windows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  broad_period text not null check (broad_period in ('morning', 'afternoon', 'evening')),
  timezone text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.equipment_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(user_id) on delete cascade,
  activity_type_id uuid not null references public.activity_types(id),
  name text not null,
  condition text,
  quantity integer not null default 1 check (quantity > 0),
  can_share boolean not null default false,
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now()
);

create table public.equipment_photos (
  id uuid primary key default gen_random_uuid(),
  equipment_item_id uuid not null references public.equipment_items(id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area_label text not null,
  public_location gis.geography(point, 4326),
  address_display text,
  is_public boolean not null default true,
  created_by uuid references public.profiles(user_id),
  created_at timestamptz not null default now(),
  check (is_public or public_location is null)
);

create index venues_public_location_gix on public.venues using gist (public_location);

create table public.venue_capabilities (
  venue_id uuid not null references public.venues(id) on delete cascade,
  activity_type_id uuid not null references public.activity_types(id),
  metadata jsonb not null default '{}'::jsonb,
  primary key (venue_id, activity_type_id)
);

create table public.venue_amenities (
  venue_id uuid not null references public.venues(id) on delete cascade,
  amenity_slug text not null,
  primary key (venue_id, amenity_slug)
);

create table public.catches (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(user_id),
  kind public.catch_kind not null,
  activity_type_id uuid not null references public.activity_types(id),
  activity_subtype_id uuid references public.activity_subtypes(id),
  title text not null check (char_length(title) between 1 and 100),
  description text check (char_length(description) <= 1000),
  starts_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 15 and 480),
  timezone text not null,
  venue_id uuid references public.venues(id),
  area_label text not null,
  discovery_location gis.geography(point, 4326),
  capacity integer not null check (capacity between 2 and 50),
  approval_required boolean not null default true,
  visibility text not null default 'public' check (visibility in ('public', 'unlisted', 'invite_only')),
  intensity text,
  minimum_age integer not null default 18 check (minimum_age in (18, 21)),
  byob_friendly boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  status public.catch_status not null default 'open',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index catches_discovery_location_gix on public.catches using gist (discovery_location);
create index catches_discovery_idx on public.catches (status, starts_at, activity_type_id);

create table public.private_location_secrets (
  catch_id uuid primary key references public.catches(id) on delete cascade,
  encrypted_instructions bytea not null,
  encryption_key_version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table public.catch_participants (
  catch_id uuid not null references public.catches(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  role text not null default 'member' check (role in ('host', 'member')),
  status public.participant_status not null default 'requested',
  joined_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (catch_id, user_id)
);

create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  catch_id uuid not null references public.catches(id) on delete cascade,
  requester_id uuid not null references public.profiles(user_id) on delete cascade,
  message text check (char_length(message) <= 500),
  status public.participant_status not null default 'requested',
  decided_by uuid references public.profiles(user_id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (catch_id, requester_id)
);

create table public.open_to_catch_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  area_label text not null,
  discovery_location gis.geography(point, 4326),
  radius_miles integer not null check (radius_miles between 1 and 100),
  broad_availability text not null,
  preferred_duration_minutes integer,
  preferred_group_size integer,
  intensity text,
  public_spaces_only boolean not null default true,
  expires_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.open_to_catch_activities (
  listing_id uuid not null references public.open_to_catch_listings(id) on delete cascade,
  activity_type_id uuid not null references public.activity_types(id),
  subtype_ids uuid[] not null default '{}',
  primary key (listing_id, activity_type_id)
);

create table public.catch_proposals (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(user_id),
  recipient_id uuid not null references public.profiles(user_id),
  open_listing_id uuid references public.open_to_catch_listings(id),
  status public.proposal_status not null default 'pending',
  current_revision integer not null default 1,
  accepted_catch_id uuid references public.catches(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create table public.proposal_revisions (
  proposal_id uuid not null references public.catch_proposals(id) on delete cascade,
  revision integer not null,
  proposed_by uuid not null references public.profiles(user_id),
  activity_type_id uuid not null references public.activity_types(id),
  starts_at timestamptz not null,
  duration_minutes integer not null,
  area_label text not null,
  venue_id uuid references public.venues(id),
  message text check (char_length(message) <= 500),
  created_at timestamptz not null default now(),
  primary key (proposal_id, revision)
);

create table public.catch_messages (
  id uuid primary key default gen_random_uuid(),
  catch_id uuid references public.catches(id) on delete cascade,
  proposal_id uuid references public.catch_proposals(id) on delete cascade,
  sender_id uuid references public.profiles(user_id),
  kind text not null default 'user' check (kind in ('user', 'system')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  check ((catch_id is not null)::integer + (proposal_id is not null)::integer = 1)
);

create table public.catch_status_history (
  id uuid primary key default gen_random_uuid(),
  catch_id uuid not null references public.catches(id) on delete cascade,
  from_status public.catch_status,
  to_status public.catch_status not null,
  actor_id uuid references public.profiles(user_id),
  reason_code text,
  created_at timestamptz not null default now()
);

create table public.blocks (
  blocker_id uuid not null references public.profiles(user_id) on delete cascade,
  blocked_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(user_id),
  target_type public.report_target not null,
  target_id uuid not null,
  category text not null,
  private_description text check (char_length(private_description) <= 2000),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  catch_id uuid not null references public.catches(id),
  rater_id uuid not null references public.profiles(user_id),
  subject_type text not null check (subject_type in ('user', 'equipment', 'venue')),
  subject_id uuid not null,
  aspect text not null,
  score smallint not null check (score between 1 and 5),
  would_catch_again boolean,
  private_note text check (char_length(private_note) <= 1000),
  created_at timestamptz not null default now(),
  unique (catch_id, rater_id, subject_type, subject_id, aspect)
);

create table public.notification_preferences (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  proposals boolean not null default true,
  join_requests boolean not null default true,
  messages boolean not null default true,
  catch_updates boolean not null default true,
  nearby_activity boolean not null default true,
  rating_reminders boolean not null default true
);

create table public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table public.profiles enable row level security;
alter table public.user_activity_preferences enable row level security;
alter table public.availability_windows enable row level security;
alter table public.equipment_items enable row level security;
alter table public.equipment_photos enable row level security;
alter table public.catches enable row level security;
alter table public.private_location_secrets enable row level security;
alter table public.catch_participants enable row level security;
alter table public.join_requests enable row level security;
alter table public.open_to_catch_listings enable row level security;
alter table public.open_to_catch_activities enable row level security;
alter table public.catch_proposals enable row level security;
alter table public.proposal_revisions enable row level security;
alter table public.catch_messages enable row level security;
alter table public.catch_status_history enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.ratings enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.device_push_tokens enable row level security;
alter table public.activity_types enable row level security;
alter table public.activity_subtypes enable row level security;
alter table public.venues enable row level security;
alter table public.venue_capabilities enable row level security;
alter table public.venue_amenities enable row level security;

create policy "activity catalog is readable"
on public.activity_types for select to anon, authenticated
using (active);

create policy "activity subtypes are readable"
on public.activity_subtypes for select to anon, authenticated
using (active);

create policy "public venues are readable"
on public.venues for select to anon, authenticated
using (is_public);

create policy "public venue capabilities are readable"
on public.venue_capabilities for select to anon, authenticated
using (
  exists (
    select 1 from public.venues v
    where v.id = venue_capabilities.venue_id
      and v.is_public
  )
);

create policy "public venue amenities are readable"
on public.venue_amenities for select to anon, authenticated
using (
  exists (
    select 1 from public.venues v
    where v.id = venue_amenities.venue_id
      and v.is_public
  )
);

create policy "profiles own write"
on public.profiles for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "activity preferences own rows"
on public.user_activity_preferences for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "availability own rows"
on public.availability_windows for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "equipment own rows"
on public.equipment_items for all to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "equipment photos follow ownership"
on public.equipment_photos for all to authenticated
using (
  exists (
    select 1 from public.equipment_items equipment
    where equipment.id = equipment_photos.equipment_item_id
      and equipment.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.equipment_items equipment
    where equipment.id = equipment_photos.equipment_item_id
      and equipment.owner_id = auth.uid()
  )
);

create policy "blocks own rows"
on public.blocks for all to authenticated
using (blocker_id = auth.uid())
with check (blocker_id = auth.uid());

create policy "reports own insert"
on public.reports for insert to authenticated
with check (reporter_id = auth.uid());

create policy "reports own read"
on public.reports for select to authenticated
using (reporter_id = auth.uid());

create policy "notification preferences own rows"
on public.notification_preferences for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "push tokens own rows"
on public.device_push_tokens for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "hosts manage catches"
on public.catches for all to authenticated
using (host_id = auth.uid())
with check (host_id = auth.uid());

create policy "participants read catches"
on public.catches for select to authenticated
using (
  exists (
    select 1 from public.catch_participants cp
    where cp.catch_id = catches.id
      and cp.user_id = auth.uid()
      and cp.status in ('approved', 'attended')
  )
);

create policy "participants read catch messages"
on public.catch_messages for select to authenticated
using (
  catch_id is not null
  and exists (
    select 1 from public.catch_participants cp
    where cp.catch_id = catch_messages.catch_id
      and cp.user_id = auth.uid()
      and cp.status in ('approved', 'attended')
  )
);

create policy "participants send catch messages"
on public.catch_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and catch_id is not null
  and exists (
    select 1 from public.catch_participants cp
    where cp.catch_id = catch_messages.catch_id
      and cp.user_id = auth.uid()
      and cp.status = 'approved'
  )
);

comment on table public.private_location_secrets is
'Opaque encrypted private-location material. Decrypt only in a trusted authorization-checked server function.';

-- The project is intentionally created with "Automatically expose new tables"
-- disabled. Grants are explicit so a table is reachable through the Data API
-- only after its RLS posture has been reviewed.
grant usage on schema public to anon, authenticated, service_role;

grant select on
  public.activity_types,
  public.activity_subtypes,
  public.venues,
  public.venue_capabilities,
  public.venue_amenities
to anon, authenticated;

grant select, insert, update, delete on
  public.profiles,
  public.user_activity_preferences,
  public.availability_windows,
  public.equipment_items,
  public.equipment_photos,
  public.catches,
  public.catch_participants,
  public.join_requests,
  public.open_to_catch_listings,
  public.open_to_catch_activities,
  public.catch_proposals,
  public.proposal_revisions,
  public.catch_messages,
  public.catch_status_history,
  public.blocks,
  public.ratings,
  public.notification_preferences,
  public.device_push_tokens
to authenticated;

grant select, insert on public.reports to authenticated;
grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
