import { getActivityColor, getActivityEmoji } from '@/constants/activity-catalog';
import { supabase } from '@/lib/supabase';

export type PastCatchInput = {
  activityTypeId: string;
  areaLabel: string;
  description: string;
  durationMinutes: number;
  guestNote: string;
  inviteeIds: string[];
  locationType: 'custom_public' | 'private';
  startsAt: string;
  timezone: string;
  title: string;
  venueName: string;
};

export type PastCatchConfirmation = {
  activityColor: string;
  activityEmoji: string;
  activityName: string;
  catchId: string;
  durationMinutes: number;
  hostName: string;
  id: string;
  locationLabel: string;
  startsAt: string;
  title: string;
};

export async function logPastCatch(input: PastCatchInput) {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('log_past_catch', {
    requested_activity_type_id: input.activityTypeId,
    requested_area_label: input.areaLabel.trim(),
    requested_description: input.description.trim() || null,
    requested_duration_minutes: input.durationMinutes,
    requested_guest_note: input.guestNote.trim() || null,
    requested_invitee_ids: input.inviteeIds,
    requested_location_type: input.locationType,
    requested_starts_at: input.startsAt,
    requested_timezone: input.timezone,
    requested_title: input.title.trim(),
    requested_venue_name:
      input.locationType === 'custom_public' ? input.venueName.trim() : null,
  });
  return { data: (data as string | null) ?? null, error: error?.message };
}

export async function listPastCatchConfirmations() {
  if (!supabase) {
    return { data: [] as PastCatchConfirmation[], error: 'Supabase is not configured.' };
  }
  const { data, error } = await supabase.rpc('list_my_past_catch_confirmations');
  if (error) return { data: [] as PastCatchConfirmation[], error: error.message };
  return {
    data: (data ?? []).map((row: {
      activity_emoji: string | null;
      activity_name: string;
      activity_slug: string;
      catch_id: string;
      confirmation_id: string;
      duration_minutes: number;
      host_name: string;
      location_label: string;
      starts_at: string;
      title: string;
    }) => ({
      activityColor: getActivityColor(row.activity_slug),
      activityEmoji: getActivityEmoji(row.activity_slug, row.activity_emoji),
      activityName: row.activity_name,
      catchId: row.catch_id,
      durationMinutes: row.duration_minutes,
      hostName: row.host_name,
      id: row.confirmation_id,
      locationLabel: row.location_label,
      startsAt: row.starts_at,
      title: row.title,
    })),
    error: null,
  };
}

export async function respondToPastCatchConfirmation(id: string, approve: boolean) {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('respond_to_past_catch_confirmation', {
    approve,
    requested_confirmation_id: id,
  });
  return { data: (data as string | null) ?? null, error: error?.message };
}
