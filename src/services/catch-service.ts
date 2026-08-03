import { getActivityColor, getActivityEmoji } from '@/constants/activity-catalog';
import { supabase } from '@/lib/supabase';

export type CatchCatalogActivity = {
  color: string;
  emoji: string;
  id: string;
  name: string;
  slug: string;
};

export type CatchVenue = {
  addressDisplay: string | null;
  areaLabel: string;
  id: string;
  name: string;
};

export type CatchStatus =
  | 'draft'
  | 'open'
  | 'full'
  | 'confirmed'
  | 'completed'
  | 'canceled'
  | 'disputed'
  | 'expired';

export type CatchLocationType = 'catalog' | 'custom_public' | 'private' | 'later';

export type PrivateCatchLocation = {
  arrivalNotes: string | null;
  exactAddress: string;
  latitude: number | null;
  longitude: number | null;
  placeName: string;
};

export type HostedCatch = {
  activity: CatchCatalogActivity;
  approvalRequired: boolean;
  capacity: number;
  customActivityName: string | null;
  customVenueArea: string | null;
  customVenueName: string | null;
  description: string;
  durationMinutes: number;
  hostFirstName: string;
  hostId: string;
  id: string;
  intensity: string;
  kind: 'now' | 'scheduled';
  locationType: CatchLocationType;
  minimumAge: 18 | 21;
  startsAt: string;
  status: CatchStatus;
  title: string;
  venue: CatchVenue | null;
};

export type CatchInput = {
  activityTypeId: string;
  approvalRequired: boolean;
  capacity: number;
  customActivityName: string;
  customVenueArea: string;
  customVenueName: string;
  description: string;
  durationMinutes: number;
  hostFirstName: string;
  hostId: string;
  intensity: string;
  kind: 'now' | 'scheduled';
  minimumAge: 18 | 21;
  locationType: CatchLocationType;
  privateLocation: PrivateCatchLocation | null;
  startsAt: string;
  title: string;
  venue: CatchVenue | null;
};

type ActivityRow = {
  emoji: string | null;
  id: string;
  name: string;
  slug: string;
};

type VenueRow = {
  address_display: string | null;
  area_label: string;
  id: string;
  name: string;
};

type HostedCatchRow = {
  activity_types: ActivityRow | ActivityRow[] | null;
  approval_required: boolean;
  capacity: number;
  description: string | null;
  duration_minutes: number;
  host_id: string;
  id: string;
  intensity: string | null;
  kind: 'now' | 'scheduled';
  metadata: Record<string, unknown> | null;
  minimum_age: 18 | 21;
  starts_at: string;
  status: CatchStatus;
  title: string;
  area_label: string;
  venues: VenueRow | VenueRow[] | null;
};

function metadataText(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function firstRelation<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function mapActivity(row: ActivityRow): CatchCatalogActivity {
  return {
    color: getActivityColor(row.slug),
    emoji: getActivityEmoji(row.slug, row.emoji),
    id: row.id,
    name: row.name,
    slug: row.slug,
  };
}

function mapVenue(row: VenueRow): CatchVenue {
  return {
    addressDisplay: row.address_display,
    areaLabel: row.area_label,
    id: row.id,
    name: row.name,
  };
}

function mapHostedCatch(row: HostedCatchRow): HostedCatch | null {
  const activity = firstRelation(row.activity_types);
  if (!activity) return null;
  const venue = firstRelation(row.venues);
  return {
    activity: mapActivity(activity),
    approvalRequired: row.approval_required,
    capacity: row.capacity,
    customActivityName: metadataText(row.metadata, 'custom_activity_name'),
    customVenueArea: metadataText(row.metadata, 'custom_venue_area') ?? row.area_label,
    customVenueName: metadataText(row.metadata, 'custom_venue_name'),
    description: row.description ?? '',
    durationMinutes: row.duration_minutes,
    hostFirstName: metadataText(row.metadata, 'host_first_name') ?? 'Someone nearby',
    hostId: row.host_id,
    id: row.id,
    intensity: row.intensity ?? 'Easygoing',
    kind: row.kind,
    locationType:
      (metadataText(row.metadata, 'location_type') as CatchLocationType | null) ??
      (venue ? 'catalog' : metadataText(row.metadata, 'custom_venue_name') ? 'custom_public' : 'later'),
    minimumAge: row.minimum_age,
    startsAt: row.starts_at,
    status: row.status,
    title: row.title,
    venue: venue ? mapVenue(venue) : null,
  };
}

const hostedCatchSelect = `
  id,
  host_id,
  kind,
  title,
  description,
  starts_at,
  duration_minutes,
  capacity,
  approval_required,
  intensity,
  minimum_age,
  status,
  metadata,
  area_label,
  activity_types(id, slug, name, emoji),
  venues(id, name, area_label, address_display)
`;

export async function loadCatchCatalog() {
  if (!supabase) {
    return {
      activities: [] as CatchCatalogActivity[],
      venues: [] as CatchVenue[],
      error: 'Supabase is not configured.',
    };
  }

  const [activityResult, venueResult] = await Promise.all([
    supabase
      .from('activity_types')
      .select('id, slug, name, emoji')
      .eq('active', true)
      .order('sort_order'),
    supabase
      .from('venues')
      .select('id, name, area_label, address_display')
      .eq('is_public', true)
      .order('name'),
  ]);
  const error = activityResult.error?.message ?? venueResult.error?.message;
  const venueRows = (venueResult.data ?? []) as VenueRow[];
  const uniqueVenues = venueRows.filter(
    (venue, index) =>
      venueRows.findIndex(
        (candidate) =>
          candidate.name === venue.name && candidate.area_label === venue.area_label,
      ) === index,
  );

  return {
    activities: ((activityResult.data ?? []) as ActivityRow[]).map(mapActivity),
    venues: uniqueVenues.map(mapVenue),
    error,
  };
}

export async function listHostedCatches(hostId: string) {
  if (!supabase) return { data: [] as HostedCatch[], error: 'Supabase is not configured.' };
  const { data, error } = await supabase
    .from('catches')
    .select(hostedCatchSelect)
    .eq('host_id', hostId)
    .order('starts_at', { ascending: true });
  if (error) return { data: [] as HostedCatch[], error: error.message };
  return {
    data: ((data ?? []) as unknown as HostedCatchRow[])
      .map(mapHostedCatch)
      .filter((item): item is HostedCatch => Boolean(item)),
    error: null,
  };
}

export async function getHostedCatch(id: string, hostId: string) {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase
    .from('catches')
    .select(hostedCatchSelect)
    .eq('id', id)
    .eq('host_id', hostId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  return {
    data: data ? mapHostedCatch(data as unknown as HostedCatchRow) : null,
    error: null,
  };
}

function catchRow(input: CatchInput) {
  const startsAt = new Date(input.startsAt);
  const expiresAt =
    input.kind === 'now'
      ? new Date(startsAt.getTime() + (input.durationMinutes + 120) * 60_000).toISOString()
      : null;
  return {
    activity_type_id: input.activityTypeId,
    approval_required: input.locationType === 'private' ? true : input.approvalRequired,
    area_label:
      input.locationType === 'catalog'
        ? input.venue?.areaLabel
        : input.customVenueArea.trim(),
    capacity: input.capacity,
    description: input.description.trim() || null,
    duration_minutes: input.durationMinutes,
    expires_at: expiresAt,
    host_id: input.hostId,
    intensity: input.intensity,
    kind: input.kind,
    minimum_age: input.minimumAge,
    metadata: {
      host_first_name: input.hostFirstName.trim(),
      location_type: input.locationType,
      ...(input.customActivityName.trim()
        ? { custom_activity_name: input.customActivityName.trim() }
        : {}),
      ...(input.locationType === 'custom_public' && input.customVenueName.trim()
        ? {
            custom_venue_area: input.customVenueArea.trim(),
            custom_venue_name: input.customVenueName.trim(),
          }
        : {}),
    },
    starts_at: input.startsAt,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    title: input.title.trim(),
    venue_id: input.locationType === 'catalog' ? input.venue?.id ?? null : null,
    visibility: 'public',
  };
}

export async function createCatch(input: CatchInput) {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase
    .from('catches')
    .insert({ ...catchRow(input), status: 'open' })
    .select('id')
    .single();
  if (error || !data?.id) return { data: null, error: error?.message ?? 'Catch was not created.' };
  const locationError = await syncPrivateLocation(data.id, input);
  if (locationError) {
    await supabase.from('catches').delete().eq('id', data.id).eq('host_id', input.hostId);
    return { data: null, error: locationError };
  }
  return { data: data.id, error: undefined };
}

export async function updateCatch(id: string, input: CatchInput) {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase
    .from('catches')
    .update({ ...catchRow(input), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('host_id', input.hostId);
  if (error) return { error: error.message };
  return { error: await syncPrivateLocation(id, input) };
}

export async function cancelCatch(id: string, hostId: string) {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase
    .from('catches')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('host_id', hostId);
  return { error: error?.message };
}

export async function completeCatch(id: string) {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.rpc('complete_catch', {
    requested_catch_id: id,
  });
  return { error: error?.message };
}

async function syncPrivateLocation(id: string, input: CatchInput) {
  if (!supabase) return 'Supabase is not configured.';
  if (input.locationType === 'private') {
    if (!input.privateLocation) return 'Enter the private meeting location.';
    const { error } = await supabase.rpc('set_private_catch_location', {
      requested_catch_id: id,
      place_name: input.privateLocation.placeName,
      exact_address: input.privateLocation.exactAddress,
      arrival_notes: input.privateLocation.arrivalNotes,
      latitude: input.privateLocation.latitude,
      longitude: input.privateLocation.longitude,
    });
    return error?.message;
  }
  const { error } = await supabase.rpc('delete_private_catch_location', {
    requested_catch_id: id,
  });
  return error?.message;
}

export async function listDiscoverableCatches(userId: string) {
  if (!supabase) return { data: [] as HostedCatch[], error: 'Supabase is not configured.' };
  const { data, error } = await supabase
    .from('catches')
    .select(hostedCatchSelect)
    .neq('host_id', userId)
    .in('status', ['open', 'full'])
    .gt('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true });
  if (error) return { data: [] as HostedCatch[], error: error.message };
  return {
    data: ((data ?? []) as unknown as HostedCatchRow[])
      .map(mapHostedCatch)
      .filter((item): item is HostedCatch => Boolean(item)),
    error: null,
  };
}

export async function getCatchDetails(id: string) {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase
    .from('catches')
    .select(hostedCatchSelect)
    .eq('id', id)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  return {
    data: data ? mapHostedCatch(data as unknown as HostedCatchRow) : null,
    error: null,
  };
}

type PrivateLocationRow = {
  arrival_notes: string | null;
  exact_address: string;
  latitude: number | null;
  longitude: number | null;
  place_name: string;
};

export async function getPrivateCatchLocation(catchId: string) {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('get_private_catch_location', {
    requested_catch_id: catchId,
  });
  if (error) return { data: null, error: error.message };
  const row = (data?.[0] ?? null) as PrivateLocationRow | null;
  return {
    data: row
      ? {
          arrivalNotes: row.arrival_notes,
          exactAddress: row.exact_address,
          latitude: row.latitude,
          longitude: row.longitude,
          placeName: row.place_name,
        }
      : null,
    error: null,
  };
}

export type JoinRequestStatus =
  | 'requested'
  | 'approved'
  | 'declined'
  | 'withdrawn'
  | 'attended'
  | 'no_show'
  | 'left';

export type JoinRequest = {
  createdAt: string;
  id: string;
  message: string | null;
  requesterFirstName: string;
  requesterId: string;
  status: JoinRequestStatus;
};

export async function getMyJoinRequest(catchId: string, userId: string) {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase
    .from('join_requests')
    .select('id, status, message, created_at')
    .eq('catch_id', catchId)
    .eq('requester_id', userId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  return {
    data: data
      ? ({
          createdAt: data.created_at,
          id: data.id,
          message: data.message,
          requesterFirstName: '',
          requesterId: userId,
          status: data.status,
        } as JoinRequest)
      : null,
    error: null,
  };
}

export async function requestToJoin(catchId: string, message: string) {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('request_to_join', {
    requested_catch_id: catchId,
    request_message: message.trim() || null,
  });
  return { data: (data as string | null) ?? null, error: error?.message };
}

export async function withdrawJoinRequest(requestId: string) {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.rpc('withdraw_join_request', {
    requested_join_request_id: requestId,
  });
  return { error: error?.message };
}

export async function listHostJoinRequests(catchId: string) {
  if (!supabase) return { data: [] as JoinRequest[], error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('list_host_join_requests', {
    requested_catch_id: catchId,
  });
  if (error) return { data: [] as JoinRequest[], error: error.message };
  return {
    data: (data ?? []).map((row: {
      created_at: string;
      id: string;
      message: string | null;
      requester_first_name: string;
      requester_id: string;
      status: JoinRequestStatus;
    }) => ({
      createdAt: row.created_at,
      id: row.id,
      message: row.message,
      requesterFirstName: row.requester_first_name,
      requesterId: row.requester_id,
      status: row.status,
    })),
    error: null,
  };
}

export async function decideJoinRequest(requestId: string, approve: boolean) {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('decide_join_request', {
    requested_join_request_id: requestId,
    approve,
  });
  return { data: (data as JoinRequestStatus | null) ?? null, error: error?.message };
}
