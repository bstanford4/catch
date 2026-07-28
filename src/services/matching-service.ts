import { getActivityColor, getActivityEmoji } from '@/constants/activity-catalog';
import { supabase } from '@/lib/supabase';

export type OpenToCatchListing = {
  broadAvailability: string;
  expiresAt: string;
  id: string;
};

export type CompatibleOpenPerson = {
  activities: {
    color: string;
    emoji: string;
    id: string;
    name: string;
    slug: string;
  }[];
  areaLabel: string;
  firstName: string;
  listingExpiresAt: string;
  overlapLabels: string[];
  userId: string;
};

export type CatchMatchNotification = {
  activity: {
    color: string;
    emoji: string;
    name: string;
    slug: string;
  };
  areaLabel: string;
  catchId: string;
  catchTitle: string;
  createdAt: string;
  durationMinutes: number;
  hostFirstName: string;
  id: string;
  locationType: string;
  matchReason: string;
  readAt: string | null;
  startsAt: string;
};

export async function getMyOpenToCatch() {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('get_my_open_to_catch');
  if (error) return { data: null, error: error.message };
  const row = data?.[0] as {
    broad_availability: string;
    expires_at: string;
    listing_id: string;
  } | undefined;
  return {
    data: row
      ? {
          broadAvailability: row.broad_availability,
          expiresAt: row.expires_at,
          id: row.listing_id,
        }
      : null,
    error: null,
  };
}

export async function publishOpenToCatch(hours = 48) {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('publish_open_to_catch', {
    requested_hours: hours,
  });
  return { data: (data as string | null) ?? null, error: error?.message };
}

export async function closeOpenToCatch() {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.rpc('close_open_to_catch');
  return { error: error?.message };
}

export async function listCompatibleOpenPeople() {
  if (!supabase) {
    return { data: [] as CompatibleOpenPerson[], error: 'Supabase is not configured.' };
  }
  const { data, error } = await supabase.rpc('list_compatible_open_people');
  if (error) return { data: [] as CompatibleOpenPerson[], error: error.message };
  return {
    data: (data ?? []).map((row: {
      activity_emojis: (string | null)[];
      activity_ids: string[];
      activity_names: string[];
      activity_slugs: string[];
      area_label: string;
      first_name: string;
      listing_expires_at: string;
      overlap_labels: string[];
      user_id: string;
    }) => ({
      activities: row.activity_ids.map((id, index) => ({
        color: getActivityColor(row.activity_slugs[index]),
        emoji: getActivityEmoji(row.activity_slugs[index], row.activity_emojis[index]),
        id,
        name: row.activity_names[index],
        slug: row.activity_slugs[index],
      })),
      areaLabel: row.area_label,
      firstName: row.first_name,
      listingExpiresAt: row.listing_expires_at,
      overlapLabels: row.overlap_labels,
      userId: row.user_id,
    })),
    error: null,
  };
}

export async function listCatchMatchNotifications() {
  if (!supabase) {
    return { data: [] as CatchMatchNotification[], error: 'Supabase is not configured.' };
  }
  const { data, error } = await supabase.rpc('list_catch_match_notifications');
  if (error) return { data: [] as CatchMatchNotification[], error: error.message };
  return {
    data: (data ?? []).map((row: {
      activity_emoji: string | null;
      activity_name: string;
      activity_slug: string;
      area_label: string;
      catch_id: string;
      catch_title: string;
      created_at: string;
      duration_minutes: number;
      host_first_name: string;
      location_type: string;
      match_reason: string;
      notification_id: string;
      read_at: string | null;
      starts_at: string;
    }) => ({
      activity: {
        color: getActivityColor(row.activity_slug),
        emoji: getActivityEmoji(row.activity_slug, row.activity_emoji),
        name: row.activity_name,
        slug: row.activity_slug,
      },
      areaLabel: row.area_label,
      catchId: row.catch_id,
      catchTitle: row.catch_title,
      createdAt: row.created_at,
      durationMinutes: row.duration_minutes,
      hostFirstName: row.host_first_name,
      id: row.notification_id,
      locationType: row.location_type,
      matchReason: row.match_reason,
      readAt: row.read_at,
      startsAt: row.starts_at,
    })),
    error: null,
  };
}

export async function markCatchMatchNotificationRead(notificationId: string) {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.rpc('mark_catch_match_notification_read', {
    requested_notification_id: notificationId,
  });
  return { error: error?.message };
}
