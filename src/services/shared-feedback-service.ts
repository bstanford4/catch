import { supabase } from '@/lib/supabase';

export type SharedFeedbackVisibility = 'private' | 'featured' | 'hidden';

export type ReceivedFeedback = {
  authorId: string;
  authorName: string;
  catchId: string;
  catchTitle: string;
  feedbackId: string;
  receivedAt: string;
  sharedNote: string;
  startsAt: string;
  visibility: SharedFeedbackVisibility;
};

export type FeaturedFeedback = {
  feedbackId: string;
  sharedNote: string;
};

export async function listAuthoredSharedFeedback(
  catchId: string,
): Promise<{ data: Map<string, string>; error: string | null }> {
  if (!supabase) return { data: new Map<string, string>(), error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('list_my_authored_shared_feedback', {
    requested_catch_id: catchId,
  });
  if (error) return { data: new Map<string, string>(), error: error.message };
  return {
    data: new Map(
      (data ?? []).map((row: { shared_note: string | null; subject_id: string }) => [
        row.subject_id,
        row.shared_note ?? '',
      ] as const),
    ),
    error: null,
  };
}

export async function saveSharedReviewNote(
  catchId: string,
  subjectId: string,
  sharedNote: string,
) {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.rpc('upsert_shared_review_note', {
    requested_catch_id: catchId,
    requested_shared_note: sharedNote.trim() || null,
    requested_subject_id: subjectId,
  });
  return { error: error?.message ?? null };
}

export async function listReceivedFeedback() {
  if (!supabase) return { data: [] as ReceivedFeedback[], error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('list_my_received_feedback');
  if (error) return { data: [] as ReceivedFeedback[], error: error.message };
  return {
    data: (data ?? []).map((row: {
      author_id: string;
      author_name: string;
      catch_id: string;
      catch_title: string;
      feedback_id: string;
      received_at: string;
      shared_note: string;
      starts_at: string;
      visibility: SharedFeedbackVisibility;
    }) => ({
      authorId: row.author_id,
      authorName: row.author_name,
      catchId: row.catch_id,
      catchTitle: row.catch_title,
      feedbackId: row.feedback_id,
      receivedAt: row.received_at,
      sharedNote: row.shared_note,
      startsAt: row.starts_at,
      visibility: row.visibility,
    })),
    error: null,
  };
}

export async function setSharedFeedbackVisibility(
  feedbackId: string,
  visibility: SharedFeedbackVisibility,
) {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.rpc('set_my_shared_feedback_visibility', {
    requested_feedback_id: feedbackId,
    requested_visibility: visibility,
  });
  return { error: error?.message ?? null };
}

export async function listFeaturedFeedback(userId: string) {
  if (!supabase) return { data: [] as FeaturedFeedback[], error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('list_featured_profile_feedback', {
    requested_user_id: userId,
  });
  if (error) return { data: [] as FeaturedFeedback[], error: error.message };
  return {
    data: (data ?? []).map((row: {
      feedback_id: string;
      shared_note: string;
    }) => ({
      feedbackId: row.feedback_id,
      sharedNote: row.shared_note,
    })),
    error: null,
  };
}
