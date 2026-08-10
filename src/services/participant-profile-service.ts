import { getActivityColor, getActivityEmoji } from '@/constants/activity-catalog';
import { supabase } from '@/lib/supabase';
import { createProfilePhotoUrl } from '@/services/profile-service';
import {
  type FeaturedFeedback,
  listFeaturedFeedback,
} from '@/services/shared-feedback-service';

export type CatchParticipant = {
  firstName: string;
  isCatchMate: boolean;
  role: 'host' | 'member';
  status: string;
  userId: string;
};

export type ShareableEquipment = {
  activityColor: string;
  activityEmoji: string;
  activityName: string;
  condition: string | null;
  id: string;
  name: string;
  photoUrl: string | null;
  quantity: number;
};

export type ParticipantScoutingReport = {
  completedCatchCount: number;
  hasEnoughReviews: boolean;
  isVisible: boolean;
  reliablePercent: number;
  reviewerCount: number;
  topTraits: string[];
  wouldAgainPercent: number;
};

export type ParticipantProfile = {
  activities: {
    color: string;
    emoji: string;
    name: string;
    slug: string;
  }[];
  areaLabel: string;
  availabilityLabels: string[];
  bio: string | null;
  catchesTogether: number;
  firstName: string;
  featuredFeedback: FeaturedFeedback[];
  isCatchMate: boolean;
  photoUrl: string | null;
  scoutingReport: ParticipantScoutingReport;
  shareableEquipment: ShareableEquipment[];
  userId: string;
};

type ParticipantEquipmentRow = {
  activity_emoji: string | null;
  activity_name: string;
  activity_slug: string;
  condition: string | null;
  equipment_id: string;
  equipment_name: string;
  photo_path: string | null;
  quantity: number;
};

type ParticipantScoutingRow = {
  catch_card_visible: boolean;
  completed_catch_count: number | string;
  reliable_percent: number | string;
  reviewer_count: number | string;
  top_traits: string[] | null;
  would_again_percent: number | string;
};

async function createEquipmentPhotoUrl(path: string | null) {
  if (!supabase || !path) return null;
  const { data, error } = await supabase.storage
    .from('equipment-photos')
    .createSignedUrl(path, 60 * 60);
  return error ? null : data.signedUrl;
}

async function mapParticipantEquipment(item: ParticipantEquipmentRow): Promise<ShareableEquipment> {
  return {
    activityColor: getActivityColor(item.activity_slug),
    activityEmoji: getActivityEmoji(item.activity_slug, item.activity_emoji),
    activityName: item.activity_name,
    condition: item.condition,
    id: item.equipment_id,
    name: item.equipment_name,
    photoUrl: await createEquipmentPhotoUrl(item.photo_path),
    quantity: item.quantity,
  };
}

export async function listParticipantShareableEquipment(userId: string) {
  if (!supabase) {
    return { data: [] as ShareableEquipment[], error: 'Supabase is not configured.' };
  }
  const { data, error } = await supabase.rpc('list_participant_shareable_equipment', {
    requested_user_id: userId,
  });
  if (error) return { data: [] as ShareableEquipment[], error: error.message };
  return {
    data: await Promise.all(((data ?? []) as ParticipantEquipmentRow[]).map(mapParticipantEquipment)),
    error: null,
  };
}

type ParticipantProfileRow = {
  activity_emojis: string[];
  activity_names: string[];
  activity_slugs: string[];
  area_label: string;
  availability_labels: string[];
  bio: string | null;
  catches_together: number | string;
  first_name: string;
  is_catch_mate: boolean;
  shareable_equipment: string[];
  user_id: string;
};

export async function listCatchParticipants(catchId: string) {
  if (!supabase) {
    return { data: [] as CatchParticipant[], error: 'Supabase is not configured.' };
  }
  const { data, error } = await supabase.rpc('list_catch_participant_profiles', {
    requested_catch_id: catchId,
  });
  if (error) return { data: [] as CatchParticipant[], error: error.message };
  return {
    data: (data ?? []).map((row: {
      first_name: string;
      is_catch_mate: boolean;
      member_role: CatchParticipant['role'];
      member_status: string;
      user_id: string;
    }) => ({
      firstName: row.first_name,
      isCatchMate: row.is_catch_mate,
      role: row.member_role,
      status: row.member_status,
      userId: row.user_id,
    })),
    error: null,
  };
}

export async function getParticipantProfile(userId: string) {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };
  const [{ data, error }, photoResult, equipmentResult, scoutingResult, feedbackResult] = await Promise.all([
    supabase.rpc('get_participant_profile', {
      requested_user_id: userId,
    }),
    supabase.rpc('get_participant_profile_photo_path', {
      requested_user_id: userId,
    }),
    supabase.rpc('list_participant_shareable_equipment', {
      requested_user_id: userId,
    }),
    supabase.rpc('get_participant_scouting_report', {
      requested_user_id: userId,
    }),
    listFeaturedFeedback(userId),
  ]);
  if (error) return { data: null, error: error.message };
  const row = (data?.[0] ?? null) as ParticipantProfileRow | null;
  if (!row) return { data: null, error: 'Participant profile not found.' };
  const photoPath =
    photoResult.error || typeof photoResult.data !== 'string' ? null : photoResult.data;
  const shareableEquipment = equipmentResult.error
    ? (row.shareable_equipment ?? []).map((name, index) => ({
        activityColor: getActivityColor('other'),
        activityEmoji: getActivityEmoji('other', null),
        activityName: 'Equipment',
        condition: null,
        id: `legacy-${index}-${name}`,
        name,
        photoUrl: null,
        quantity: 1,
      }))
    : await Promise.all(
        ((equipmentResult.data ?? []) as ParticipantEquipmentRow[]).map(mapParticipantEquipment),
      );
  return {
    data: {
      activities: row.activity_names.map((name, index) => {
        const slug = row.activity_slugs[index] ?? 'other';
        return {
          color: getActivityColor(slug),
          emoji: getActivityEmoji(slug, row.activity_emojis[index]),
          name,
          slug,
        };
      }),
      areaLabel: row.area_label,
      availabilityLabels: row.availability_labels ?? [],
      bio: row.bio,
      catchesTogether: Number(row.catches_together) || 0,
      firstName: row.first_name,
      featuredFeedback: feedbackResult.data,
      isCatchMate: row.is_catch_mate,
      photoUrl: await createProfilePhotoUrl(photoPath),
      scoutingReport: mapParticipantScoutingReport(
        scoutingResult.error
          ? null
          : ((scoutingResult.data?.[0] ?? null) as ParticipantScoutingRow | null),
      ),
      shareableEquipment,
      userId: row.user_id,
    } satisfies ParticipantProfile,
    error: null,
  };
}

function mapParticipantScoutingReport(
  row: ParticipantScoutingRow | null,
): ParticipantScoutingReport {
  const reviewerCount = Number(row?.reviewer_count ?? 0);
  return {
    completedCatchCount: Number(row?.completed_catch_count ?? 0),
    hasEnoughReviews: Boolean(row?.catch_card_visible) && reviewerCount >= 3,
    isVisible: row?.catch_card_visible ?? true,
    reliablePercent: Number(row?.reliable_percent ?? 0),
    reviewerCount,
    topTraits: row?.top_traits ?? [],
    wouldAgainPercent: Number(row?.would_again_percent ?? 0),
  };
}

export async function blockParticipant(userId: string) {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const currentUserId = (await supabase.auth.getUser()).data.user?.id;
  if (!currentUserId) return { error: 'Authentication required.' };
  const { error } = await supabase.from('blocks').insert({
    blocked_id: userId,
    blocker_id: currentUserId,
  });
  return { error: error?.message };
}

export async function reportParticipant(userId: string, description: string) {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const currentUserId = (await supabase.auth.getUser()).data.user?.id;
  if (!currentUserId) return { error: 'Authentication required.' };
  const normalized = description.trim();
  if (normalized.length < 10) {
    return { error: 'Please include at least a short explanation.' };
  }
  const { error } = await supabase.from('reports').insert({
    category: 'participant_profile',
    private_description: normalized,
    reporter_id: currentUserId,
    target_id: userId,
    target_type: 'user',
  });
  return { error: error?.message };
}
