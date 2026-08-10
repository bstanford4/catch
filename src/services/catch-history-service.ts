import { getActivityColor, getActivityEmoji } from '@/constants/activity-catalog';
import { supabase } from '@/lib/supabase';
import {
  type MyAttendanceStatus,
  type ResolvedAttendance,
  listMyAttendanceStatuses,
} from '@/services/attendance-service';
import { listMyPostCatchReviewStatuses } from '@/services/post-catch-review-service';

export type CatchHistoryItem = {
  activityColor: string;
  activityEmoji: string;
  activityName: string;
  attendanceRequired: boolean;
  attendanceStatus: ResolvedAttendance;
  catchId: string;
  durationMinutes: number;
  locationLabel: string;
  memberRole: 'host' | 'participant';
  participantNames: string[];
  photoCount: number;
  previewUrls: string[];
  reviewCompletedCount: number;
  reviewEligibleCount: number;
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
  const [{ data, error }, reviewResult, attendanceResult] = await Promise.all([
    supabase.rpc('list_my_catch_history', {
      requested_limit: limit,
      requested_offset: offset,
    }),
    listMyPostCatchReviewStatuses(),
    listMyAttendanceStatuses(),
  ]);
  if (error) return { data: [] as CatchHistoryItem[], error: error.message };
  const reviewByCatch = new Map(reviewResult.data.map((status) => [status.catchId, status]));
  const attendanceByCatch = new Map<string, MyAttendanceStatus>(
    attendanceResult.data.map((status: MyAttendanceStatus) => [status.catchId, status]),
  );

  const rows = (data ?? []) as CatchHistoryRow[];
  const mapped = await Promise.all(
    rows.map(async (row) => {
      const signed = await Promise.all((row.preview_paths ?? []).map(signPreview));
      const urlError = signed.find((preview) => preview.error)?.error;
      const review = reviewByCatch.get(row.catch_id);
      const attendance = attendanceByCatch.get(row.catch_id);
      return {
        item: {
          activityColor: getActivityColor(row.activity_slug),
          activityEmoji: getActivityEmoji(row.activity_slug, row.activity_emoji),
          activityName: row.activity_name,
          attendanceRequired: attendance?.attendanceRequired ?? false,
          attendanceStatus: attendance?.resolvedStatus ?? 'attended',
          catchId: row.catch_id,
          durationMinutes: row.duration_minutes,
          locationLabel: row.location_label,
          memberRole: row.member_role,
          participantNames: row.participant_names ?? [],
          photoCount: Number(row.photo_count),
          previewUrls: signed.flatMap((preview) => (preview.url ? [preview.url] : [])),
          reviewCompletedCount: review?.completedCount ?? 0,
          reviewEligibleCount: review?.eligibleCount ?? 0,
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
    error:
      mapped.find(({ urlError }) => urlError)?.urlError ??
      reviewResult.error ??
      attendanceResult.error ??
      null,
  };
}
