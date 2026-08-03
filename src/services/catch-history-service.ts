import { getActivityColor, getActivityEmoji } from '@/constants/activity-catalog';
import { supabase } from '@/lib/supabase';

export type CatchHistoryItem = {
  activityColor: string;
  activityEmoji: string;
  activityName: string;
  catchId: string;
  durationMinutes: number;
  locationLabel: string;
  memberRole: 'host' | 'participant';
  participantNames: string[];
  photoCount: number;
  previewUrls: string[];
  startsAt: string;
  title: string;
  videoCount: number;
};

type CatchHistoryRow = {
  activity_emoji: string | null;
  activity_name: string;
  activity_slug: string;
  catch_id: string;
  duration_minutes: number;
  location_label: string;
  member_role: 'host' | 'participant';
  participant_names: string[] | null;
  photo_count: number | string;
  preview_paths: string[] | null;
  starts_at: string;
  title: string;
  video_count: number | string;
};

async function signPreview(path: string) {
  if (!supabase) return { url: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.storage
    .from('catch-memories')
    .createSignedUrl(path, 60 * 60);
  return { url: data?.signedUrl ?? null, error: error?.message ?? null };
}

export async function listMyCatchHistory(limit = 50, offset = 0) {
  if (!supabase) return { data: [] as CatchHistoryItem[], error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('list_my_catch_history', {
    requested_limit: limit,
    requested_offset: offset,
  });
  if (error) return { data: [] as CatchHistoryItem[], error: error.message };

  const rows = (data ?? []) as CatchHistoryRow[];
  const mapped = await Promise.all(
    rows.map(async (row) => {
      const signed = await Promise.all((row.preview_paths ?? []).map(signPreview));
      const urlError = signed.find((preview) => preview.error)?.error;
      return {
        item: {
          activityColor: getActivityColor(row.activity_slug),
          activityEmoji: getActivityEmoji(row.activity_slug, row.activity_emoji),
          activityName: row.activity_name,
          catchId: row.catch_id,
          durationMinutes: row.duration_minutes,
          locationLabel: row.location_label,
          memberRole: row.member_role,
          participantNames: row.participant_names ?? [],
          photoCount: Number(row.photo_count),
          previewUrls: signed.flatMap((preview) => (preview.url ? [preview.url] : [])),
          startsAt: row.starts_at,
          title: row.title,
          videoCount: Number(row.video_count),
        } satisfies CatchHistoryItem,
        urlError,
      };
    }),
  );
  return {
    data: mapped.map(({ item }) => item),
    error: mapped.find(({ urlError }) => urlError)?.urlError ?? null,
  };
}
