import { getActivityColor, getActivityEmoji } from '@/constants/activity-catalog';
import { supabase } from '@/lib/supabase';
import { normalizeMessageBody, validateMessageBody } from '@/services/message-utils';

export type MessageThreadType = 'catch' | 'direct' | 'proposal';

export type MessageThread = {
  activity: {
    color: string;
    emoji: string;
    name: string;
    slug: string;
  };
  canSend: boolean;
  contextLabel: string;
  id: string;
  latestAt: string;
  latestBody: string;
  otherFirstName: string;
  startsAt: string | null;
  status: string;
  title: string;
  type: MessageThreadType;
  unreadCount: number;
};

export type ThreadMessage = {
  body: string;
  createdAt: string;
  id: string;
  isOwn: boolean;
  kind: 'system' | 'user';
  senderFirstName: string;
  senderId: string | null;
};

type ThreadRow = {
  activity_emoji: string | null;
  activity_name: string;
  activity_slug: string;
  can_send: boolean;
  context_label: string;
  latest_at: string;
  latest_body: string;
  other_first_name: string;
  starts_at: string;
  status: string;
  thread_id: string;
  thread_type: MessageThreadType;
  title: string;
  unread_count: number | string;
};

type DirectThreadRow = {
  latest_at: string;
  latest_body: string;
  other_first_name: string;
  other_user_id: string;
  thread_id: string;
  unread_count: number | string;
};

export async function listMessageThreads() {
  if (!supabase) {
    return { data: [] as MessageThread[], error: 'Supabase is not configured.' };
  }
  const [contextualResult, directResult] = await Promise.all([
    supabase.rpc('list_message_threads'),
    supabase.rpc('list_direct_message_threads'),
  ]);
  if (contextualResult.error || directResult.error) {
    return {
      data: [] as MessageThread[],
      error: contextualResult.error?.message ?? directResult.error?.message ?? 'Messages unavailable.',
    };
  }
  const contextualThreads = ((contextualResult.data ?? []) as ThreadRow[]).map((row) => ({
    activity: {
      color: getActivityColor(row.activity_slug),
      emoji: getActivityEmoji(row.activity_slug, row.activity_emoji),
      name: row.activity_name,
      slug: row.activity_slug,
    },
    canSend: row.can_send,
    contextLabel: row.context_label,
    id: row.thread_id,
    latestAt: row.latest_at,
    latestBody: row.latest_body,
    otherFirstName: row.other_first_name,
    startsAt: row.starts_at,
    status: row.status,
    title: row.title,
    type: row.thread_type,
    unreadCount: Number(row.unread_count) || 0,
  }));
  const directThreads = ((directResult.data ?? []) as DirectThreadRow[]).map((row) => ({
    activity: {
      color: '#E5EFE6',
      emoji: '💬',
      name: 'Direct message',
      slug: 'direct-message',
    },
    canSend: true,
    contextLabel: 'Catch Mate',
    id: row.thread_id,
    latestAt: row.latest_at,
    latestBody: row.latest_body,
    otherFirstName: row.other_first_name,
    startsAt: null,
    status: 'private chat',
    title: row.other_first_name,
    type: 'direct' as const,
    unreadCount: Number(row.unread_count) || 0,
  }));
  return {
    data: [...contextualThreads, ...directThreads].sort(
      (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime(),
    ),
    error: null,
  };
}

export async function listThreadMessages(type: MessageThreadType, id: string) {
  if (!supabase) {
    return { data: [] as ThreadMessage[], error: 'Supabase is not configured.' };
  }
  const { data, error } =
    type === 'direct'
      ? await supabase.rpc('list_direct_messages', { requested_thread_id: id })
      : await supabase.rpc('list_thread_messages', {
          requested_thread_id: id,
          requested_thread_type: type,
        });
  if (error) return { data: [] as ThreadMessage[], error: error.message };
  return {
    data: (data ?? []).map((row: {
      body: string;
      created_at: string;
      is_own: boolean;
      kind: ThreadMessage['kind'];
      message_id: string;
      sender_first_name: string;
      sender_id: string | null;
    }) => ({
      body: row.body,
      createdAt: row.created_at,
      id: row.message_id,
      isOwn: row.is_own,
      kind: row.kind,
      senderFirstName: row.sender_first_name,
      senderId: row.sender_id,
    })),
    error: null,
  };
}

export async function markMessageThreadRead(type: MessageThreadType, id: string) {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } =
    type === 'direct'
      ? await supabase.rpc('mark_direct_message_read', { requested_thread_id: id })
      : await supabase.rpc('mark_message_thread_read', {
          requested_thread_id: id,
          requested_thread_type: type,
        });
  return { error: error?.message };
}

export async function sendThreadMessage(
  type: MessageThreadType,
  id: string,
  body: string,
) {
  const validationError = validateMessageBody(body);
  if (validationError) return { data: null, error: validationError };
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };
  const { data, error } =
    type === 'direct'
      ? await supabase.rpc('send_direct_message', {
          requested_body: normalizeMessageBody(body),
          requested_thread_id: id,
        })
      : await supabase.rpc('send_thread_message', {
          requested_body: normalizeMessageBody(body),
          requested_thread_id: id,
          requested_thread_type: type,
        });
  return { data: (data as string | null) ?? null, error: error?.message };
}

export function subscribeToThreadMessages(
  type: MessageThreadType,
  id: string,
  onMessage: () => void,
) {
  if (!supabase) return () => undefined;
  const client = supabase;
  if (type === 'direct') {
    const channel = client
      .channel(`messages:direct:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          filter: `thread_id=eq.${id}`,
          schema: 'public',
          table: 'direct_messages',
        },
        onMessage,
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }
  const column = type === 'catch' ? 'catch_id' : 'proposal_id';
  const channel = client
    .channel(`messages:${type}:${id}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        filter: `${column}=eq.${id}`,
        schema: 'public',
        table: 'catch_messages',
      },
      onMessage,
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToMessageThreads(onMessage: () => void) {
  if (!supabase) return () => undefined;
  const client = supabase;
  const channel = client
    .channel('message-thread-list')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'catch_messages' },
      onMessage,
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'direct_messages' },
      onMessage,
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

export async function startDirectMessage(otherUserId: string) {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('start_direct_message', {
    requested_other_id: otherUserId,
  });
  return { data: (data as string | null) ?? null, error: error?.message };
}
