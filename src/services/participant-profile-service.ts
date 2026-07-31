import { getActivityColor, getActivityEmoji } from '@/constants/activity-catalog';
import { supabase } from '@/lib/supabase';

export type CatchParticipant = {
  firstName: string;
  isCatchMate: boolean;
  role: 'host' | 'member';
  status: string;
  userId: string;
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
  isCatchMate: boolean;
  shareableEquipment: string[];
  userId: string;
};

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
  const { data, error } = await supabase.rpc('get_participant_profile', {
    requested_user_id: userId,
  });
  if (error) return { data: null, error: error.message };
  const row = (data?.[0] ?? null) as ParticipantProfileRow | null;
  if (!row) return { data: null, error: 'Participant profile not found.' };
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
      isCatchMate: row.is_catch_mate,
      shareableEquipment: row.shareable_equipment ?? [],
      userId: row.user_id,
    } satisfies ParticipantProfile,
    error: null,
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
