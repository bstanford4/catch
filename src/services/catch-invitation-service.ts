import { getActivityColor, getActivityEmoji } from '@/constants/activity-catalog';
import { supabase } from '@/lib/supabase';

export type CatchInvitationStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'withdrawn'
  | 'expired';

export type HostCatchInvitation = {
  inviteeId: string;
  inviteeName: string;
  status: 'pending' | 'accepted';
};

export type ReceivedCatchInvitation = {
  activity: {
    color: string;
    emoji: string;
    id: string;
    name: string;
    slug: string;
  };
  areaLabel: string;
  catchId: string;
  catchTitle: string;
  createdAt: string;
  durationMinutes: number;
  hostName: string;
  id: string;
  locationType: 'catalog' | 'custom_public' | 'private' | 'later';
  startsAt: string;
  status: CatchInvitationStatus;
  venueName: string | null;
};

export async function syncCatchMateInvitations(catchId: string, inviteeIds: string[]) {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.rpc('sync_catch_mate_invitations', {
    requested_catch_id: catchId,
    requested_invitee_ids: inviteeIds,
  });
  return { error: error?.message };
}

export async function listHostCatchInvitations(catchId: string) {
  if (!supabase) {
    return { data: [] as HostCatchInvitation[], error: 'Supabase is not configured.' };
  }
  const { data, error } = await supabase.rpc('list_host_catch_invitations', {
    requested_catch_id: catchId,
  });
  if (error) return { data: [] as HostCatchInvitation[], error: error.message };
  return {
    data: (data ?? []).map((row: {
      invitee_id: string;
      invitee_name: string;
      status: HostCatchInvitation['status'];
    }) => ({
      inviteeId: row.invitee_id,
      inviteeName: row.invitee_name,
      status: row.status,
    })),
    error: null,
  };
}

export async function listReceivedCatchInvitations() {
  if (!supabase) {
    return { data: [] as ReceivedCatchInvitation[], error: 'Supabase is not configured.' };
  }
  const { data, error } = await supabase.rpc('list_my_received_catch_invitations');
  if (error) return { data: [] as ReceivedCatchInvitation[], error: error.message };
  return {
    data: (data ?? []).map((row: {
      activity_emoji: string | null;
      activity_name: string;
      activity_slug: string;
      activity_type_id: string;
      area_label: string;
      catch_id: string;
      catch_title: string;
      created_at: string;
      duration_minutes: number;
      host_name: string;
      invitation_id: string;
      location_type: ReceivedCatchInvitation['locationType'];
      starts_at: string;
      status: CatchInvitationStatus;
      venue_name: string | null;
    }) => ({
      activity: {
        color: getActivityColor(row.activity_slug),
        emoji: getActivityEmoji(row.activity_slug, row.activity_emoji),
        id: row.activity_type_id,
        name: row.activity_name,
        slug: row.activity_slug,
      },
      areaLabel: row.area_label,
      catchId: row.catch_id,
      catchTitle: row.catch_title,
      createdAt: row.created_at,
      durationMinutes: row.duration_minutes,
      hostName: row.host_name,
      id: row.invitation_id,
      locationType: row.location_type,
      startsAt: row.starts_at,
      status: row.status,
      venueName: row.venue_name,
    })),
    error: null,
  };
}

export async function decideCatchInvitation(invitationId: string, approve: boolean) {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('decide_catch_invitation', {
    approve,
    requested_invitation_id: invitationId,
  });
  return { data: (data as string | null) ?? null, error: error?.message };
}
