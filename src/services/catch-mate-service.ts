import { getActivityColor, getActivityEmoji } from '@/constants/activity-catalog';
import { supabase } from '@/lib/supabase';

export type SavedCatchMate = {
  areaLabel: string;
  firstName: string;
  id: string;
  savedAt: string;
  source: 'shared_catch' | 'friend_code';
};

export type CatchMateInvite = {
  code: string;
  expiresAt: string;
};

export type DirectCatchProposal = {
  acceptedCatchId: string | null;
  allowOthersToJoin: boolean;
  activity: {
    color: string;
    emoji: string;
    id: string;
    name: string;
    slug: string;
  };
  areaLabel: string;
  createdAt: string;
  direction: 'sent' | 'received';
  durationMinutes: number;
  id: string;
  message: string | null;
  maximumParticipants: number;
  locationType: 'later' | 'catalog' | 'private';
  otherFirstName: string;
  otherUserId: string;
  startsAt: string;
  status: 'pending' | 'accepted' | 'declined' | 'countered' | 'expired' | 'withdrawn';
  venueId: string | null;
  venueName: string | null;
};

export type DirectProposalInput = {
  activityTypeId: string;
  allowOthersToJoin: boolean;
  areaLabel: string;
  durationMinutes: number;
  message: string;
  maximumParticipants: number;
  locationType: 'later' | 'catalog' | 'private';
  privateLocation: {
    arrivalNotes: string | null;
    exactAddress: string;
    latitude: number | null;
    longitude: number | null;
    placeName: string;
  } | null;
  recipientId: string;
  startsAt: string;
  venueId: string | null;
};

export async function listCatchMates() {
  if (!supabase) return { data: [] as SavedCatchMate[], error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('list_catch_mates');
  if (error) return { data: [] as SavedCatchMate[], error: error.message };
  return {
    data: (data ?? []).map((row: {
      area_label: string;
      first_name: string;
      mate_id: string;
      saved_at: string;
      source: SavedCatchMate['source'];
    }) => ({
      areaLabel: row.area_label,
      firstName: row.first_name,
      id: row.mate_id,
      savedAt: row.saved_at,
      source: row.source,
    })),
    error: null,
  };
}

export async function saveCatchMate(mateId: string) {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.rpc('save_catch_mate', {
    requested_mate_id: mateId,
  });
  return { error: error?.message };
}

export async function removeCatchMate(mateId: string) {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.rpc('remove_catch_mate', {
    requested_mate_id: mateId,
  });
  return { error: error?.message };
}

export async function createCatchMateInvite() {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('create_catch_mate_invite');
  if (error) return { data: null, error: error.message };
  const row = data?.[0] as { expires_at: string; invite_code: string } | undefined;
  return {
    data: row ? { code: row.invite_code, expiresAt: row.expires_at } : null,
    error: null,
  };
}

export async function redeemCatchMateInvite(code: string) {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('redeem_catch_mate_invite', {
    requested_code: code,
  });
  return { data: (data as string | null) ?? null, error: error?.message };
}

export async function createDirectCatchProposal(input: DirectProposalInput) {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('create_direct_catch_proposal_v2', {
    requested_allow_others_to_join: input.allowOthersToJoin,
    requested_activity_type_id: input.activityTypeId,
    requested_area_label: input.areaLabel,
    requested_duration_minutes: input.durationMinutes,
    requested_message: input.message.trim() || null,
    requested_location_type: input.locationType,
    requested_private_place_name: input.privateLocation?.placeName.trim() ?? null,
    requested_exact_address: input.privateLocation?.exactAddress.trim() ?? null,
    requested_arrival_notes: input.privateLocation?.arrivalNotes?.trim() || null,
    requested_latitude: input.privateLocation?.latitude ?? null,
    requested_longitude: input.privateLocation?.longitude ?? null,
    requested_maximum_participants: input.allowOthersToJoin ? input.maximumParticipants : 2,
    requested_recipient_id: input.recipientId,
    requested_starts_at: input.startsAt,
    requested_venue_id: input.venueId,
  });
  return { data: (data as string | null) ?? null, error: error?.message };
}

export async function listDirectCatchProposals() {
  if (!supabase) {
    return { data: [] as DirectCatchProposal[], error: 'Supabase is not configured.' };
  }
  const { data, error } = await supabase.rpc('list_direct_catch_proposals_v2');
  if (error) return { data: [] as DirectCatchProposal[], error: error.message };
  return {
    data: (data ?? []).map((row: {
      accepted_catch_id: string | null;
      allow_others_to_join: boolean;
      activity_emoji: string | null;
      activity_name: string;
      activity_slug: string;
      activity_type_id: string;
      area_label: string;
      created_at: string;
      direction: DirectCatchProposal['direction'];
      duration_minutes: number;
      message: string | null;
      maximum_participants: number;
      location_type: DirectCatchProposal['locationType'];
      other_first_name: string;
      other_user_id: string;
      proposal_id: string;
      starts_at: string;
      status: DirectCatchProposal['status'];
      venue_id: string | null;
      venue_name: string | null;
    }) => ({
      acceptedCatchId: row.accepted_catch_id,
      allowOthersToJoin: row.allow_others_to_join,
      activity: {
        color: getActivityColor(row.activity_slug),
        emoji: getActivityEmoji(row.activity_slug, row.activity_emoji),
        id: row.activity_type_id,
        name: row.activity_name,
        slug: row.activity_slug,
      },
      areaLabel: row.area_label,
      createdAt: row.created_at,
      direction: row.direction,
      durationMinutes: row.duration_minutes,
      id: row.proposal_id,
      message: row.message,
      maximumParticipants: row.maximum_participants,
      locationType: row.location_type,
      otherFirstName: row.other_first_name,
      otherUserId: row.other_user_id,
      startsAt: row.starts_at,
      status: row.status,
      venueId: row.venue_id,
      venueName: row.venue_name,
    })),
    error: null,
  };
}

export async function decideDirectCatchProposal(proposalId: string, approve: boolean) {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('decide_direct_catch_proposal', {
    approve,
    requested_proposal_id: proposalId,
  });
  return { data: (data as string | null) ?? null, error: error?.message };
}

export async function withdrawDirectCatchProposal(proposalId: string) {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.rpc('withdraw_direct_catch_proposal', {
    requested_proposal_id: proposalId,
  });
  return { error: error?.message };
}
