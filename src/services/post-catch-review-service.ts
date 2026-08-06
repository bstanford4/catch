import { supabase } from '@/lib/supabase';
import {
  type PostCatchTrait,
  validatePostCatchReview,
} from '@/services/post-catch-review-utils';

export type PostCatchReviewTarget = {
  catchId: string;
  catchTitle: string;
  privateNote: string;
  reviewedAt: string | null;
  score: number | null;
  startsAt: string;
  subjectId: string;
  subjectName: string;
  traits: PostCatchTrait[];
  wouldCatchAgain: boolean | null;
};

type PostCatchReviewRow = {
  catch_id: string;
  catch_title: string;
  private_note: string | null;
  reviewed_at: string | null;
  score: number | null;
  starts_at: string;
  subject_id: string;
  subject_name: string;
  traits: PostCatchTrait[] | null;
  would_catch_again: boolean | null;
};

type ReviewStatusRow = {
  catch_id: string;
  completed_count: number | string;
  eligible_count: number | string;
};

export type PostCatchReviewStatus = {
  catchId: string;
  completedCount: number;
  eligibleCount: number;
};

export type ScoutingReport = {
  averageScore: number | null;
  completedCatchCount: number;
  ratingCount: number;
  reliablePercent: number;
  topTraits: PostCatchTrait[];
  wouldAgainPercent: number;
};

type ScoutingReportRow = {
  average_score: number | string | null;
  completed_catch_count: number | string;
  rating_count: number | string;
  reliable_percent: number | string;
  top_traits: PostCatchTrait[] | null;
  would_again_percent: number | string;
};

export async function listPostCatchReview(catchId: string) {
  if (!supabase) return { data: [] as PostCatchReviewTarget[], error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('list_post_catch_review', {
    requested_catch_id: catchId,
  });
  if (error) return { data: [] as PostCatchReviewTarget[], error: error.message };
  return {
    data: ((data ?? []) as PostCatchReviewRow[]).map((row) => ({
      catchId: row.catch_id,
      catchTitle: row.catch_title,
      privateNote: row.private_note ?? '',
      reviewedAt: row.reviewed_at,
      score: row.score,
      startsAt: row.starts_at,
      subjectId: row.subject_id,
      subjectName: row.subject_name,
      traits: row.traits ?? [],
      wouldCatchAgain: row.would_catch_again,
    })),
    error: null,
  };
}

export async function savePostCatchReview(input: {
  catchId: string;
  privateNote: string;
  score: number | null;
  subjectId: string;
  traits: PostCatchTrait[];
  wouldCatchAgain: boolean | null;
}) {
  const validationError = validatePostCatchReview(input);
  if (validationError) return { error: validationError };
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.rpc('upsert_post_catch_review', {
    requested_catch_id: input.catchId,
    requested_private_note: input.privateNote.trim() || null,
    requested_score: input.score,
    requested_subject_id: input.subjectId,
    requested_traits: input.traits,
    requested_would_catch_again: input.wouldCatchAgain,
  });
  return { error: error?.message ?? null };
}

export async function listMyPostCatchReviewStatuses() {
  if (!supabase) return { data: [] as PostCatchReviewStatus[], error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('list_my_post_catch_review_status');
  if (error) return { data: [] as PostCatchReviewStatus[], error: error.message };
  return {
    data: ((data ?? []) as ReviewStatusRow[]).map((row) => ({
      catchId: row.catch_id,
      completedCount: Number(row.completed_count),
      eligibleCount: Number(row.eligible_count),
    })),
    error: null,
  };
}

export async function getMyScoutingReport() {
  const empty: ScoutingReport = {
    averageScore: null,
    completedCatchCount: 0,
    ratingCount: 0,
    reliablePercent: 0,
    topTraits: [],
    wouldAgainPercent: 0,
  };
  if (!supabase) return { data: empty, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('get_my_scouting_report');
  if (error) return { data: empty, error: error.message };
  const row = ((data ?? []) as ScoutingReportRow[])[0];
  if (!row) return { data: empty, error: null };
  return {
    data: {
      averageScore: row.average_score === null ? null : Number(row.average_score),
      completedCatchCount: Number(row.completed_catch_count),
      ratingCount: Number(row.rating_count),
      reliablePercent: Number(row.reliable_percent),
      topTraits: row.top_traits ?? [],
      wouldAgainPercent: Number(row.would_again_percent),
    },
    error: null,
  };
}
