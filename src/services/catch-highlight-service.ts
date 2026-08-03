import { getActivityColor, getActivityEmoji } from '@/constants/activity-catalog';
import { supabase } from '@/lib/supabase';

export type PublicCatchHighlightPhoto = {
  id: string;
  url: string;
};

export type PublicCatchHighlight = {
  activityColor: string;
  activityEmoji: string;
  activityName: string;
  catchId: string;
  participantNames: string[];
  photoCount: number;
  photos: PublicCatchHighlightPhoto[];
  startsAt: string;
  title: string;
  venueName: string;
};

type PublicCatchHighlightRow = {
  activity_emoji: string | null;
  activity_name: string;
  activity_slug: string;
  catch_id: string;
  media_ids: string[];
  participant_names: string[] | null;
  photo_count: number | string;
  starts_at: string;
  storage_paths: string[];
  title: string;
  venue_name: string;
};

async function signPublicPhoto(path: string) {
  if (!supabase) return { url: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.storage
    .from('catch-memories')
    .createSignedUrl(path, 60 * 60);
  return { url: data?.signedUrl ?? null, error: error?.message ?? null };
}

export async function listPublicCatchHighlights(limit = 20, offset = 0) {
  if (!supabase) {
    return { data: [] as PublicCatchHighlight[], error: 'Supabase is not configured.' };
  }
  const { data, error } = await supabase.rpc('list_public_catch_highlights', {
    requested_limit: limit,
    requested_offset: offset,
  });
  if (error) return { data: [] as PublicCatchHighlight[], error: error.message };

  const rows = (data ?? []) as PublicCatchHighlightRow[];
  const mapped = await Promise.all(
    rows.map(async (row) => {
      const signed = await Promise.all(row.storage_paths.map(signPublicPhoto));
      const photos = signed.flatMap((item, index) =>
        item.url && row.media_ids[index]
          ? [{ id: row.media_ids[index], url: item.url }]
          : [],
      );
      return {
        activityColor: getActivityColor(row.activity_slug),
        activityEmoji: getActivityEmoji(row.activity_slug, row.activity_emoji),
        activityName: row.activity_name,
        catchId: row.catch_id,
        participantNames: row.participant_names ?? [],
        photoCount: Number(row.photo_count),
        photos,
        startsAt: row.starts_at,
        title: row.title,
        venueName: row.venue_name,
      } satisfies PublicCatchHighlight;
    }),
  );
  return { data: mapped.filter((item) => item.photos.length > 0), error: null };
}

export async function reportPublicCatchPhoto(
  mediaId: string,
  category: 'privacy_or_permission' | 'inappropriate' | 'other',
) {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.rpc('report_public_catch_memory', {
    requested_category: category,
    requested_detail: null,
    requested_memory_id: mediaId,
  });
  return { error: error?.message };
}
