import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Screen } from '@/components/ui/screen';
import { StatePanel } from '@/components/ui/state-panel';
import { colors, radius, spacing } from '@/constants/theme';
import { messageThreads } from '@/data/demo';
import { useAuth } from '@/providers/auth-provider';
import {
  catchPlanTimestamp,
  conversationPeopleLabel,
  messageTimestamp,
} from '@/services/message-utils';
import {
  type MessageThread,
  listMessageThreads,
  subscribeToMessageThreads,
} from '@/services/messaging-service';
import { memberInitials } from '@/utils/member-name';

export default function MessagesScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    const result = await listMessageThreads();
    setThreads(result.data);
    setError(result.error ?? '');
    setIsLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!session) return;
    return subscribeToMessageThreads(() => {
      void load();
    });
  }, [load, session]);

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>KEEP THE PLAN MOVING</Text>
          <Text style={styles.title}>Messages</Text>
        </View>
        <Pressable
          accessibilityLabel="View Catch invitations and proposals"
          onPress={() => router.push('/proposals')}
          style={styles.headerButton}>
          <Ionicons color={colors.forest} name="paper-plane-outline" size={20} />
        </Pressable>
      </View>

      <View style={styles.notice}>
        <Ionicons color={colors.orangeDark} name="lock-closed" size={17} />
        <Text style={styles.noticeText}>
          Catch chats and Catch Mate messages stay private.
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {session && isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.orange} />
          <Text style={styles.muted}>Loading conversations...</Text>
        </View>
      ) : null}

      <View style={styles.list}>
        {session && !isLoading && threads.length === 0 ? (
          <StatePanel
            action="View invitations & proposals"
            body="Message a Catch Mate, send a proposal, or join a Catch. The conversation will appear here."
            icon="chatbubble-ellipses-outline"
            onAction={() => router.push('/proposals')}
            title="No conversations yet"
          />
        ) : null}
        {session
          ? threads.map((thread) => (
              <LiveThread
                item={thread}
                key={`${thread.type}:${thread.id}`}
                onPress={() =>
                  router.push({
                    pathname: '/message/[type]/[id]',
                    params: { id: thread.id, type: thread.type },
                  })
                }
              />
            ))
          : messageThreads.map((thread) => (
              <Pressable
                accessibilityLabel={`${thread.name}. ${thread.preview}`}
                key={thread.id}
                style={({ pressed }) => [styles.thread, pressed && styles.pressed]}>
                <Avatar
                  initials={thread.initials}
                  size={52}
                  tone={thread.system ? 'green' : 'gold'}
                />
                <View style={styles.threadContent}>
                  <View style={styles.threadHeading}>
                    <Text numberOfLines={1} style={styles.threadName}>
                      {thread.name}
                    </Text>
                    <Text style={styles.timestamp}>{thread.timestamp}</Text>
                  </View>
                  <Text style={styles.context}>{thread.context}</Text>
                  <Text numberOfLines={1} style={styles.preview}>
                    {thread.preview}
                  </Text>
                </View>
                {thread.unread ? <UnreadBadge count={thread.unread} /> : null}
              </Pressable>
            ))}
      </View>
    </Screen>
  );
}

function LiveThread({ item, onPress }: { item: MessageThread; onPress: () => void }) {
  if (item.type === 'direct') {
    return (
      <Pressable
        accessibilityLabel={`Private conversation with ${item.otherFirstName}. ${item.latestBody}`}
        onPress={onPress}
        style={({ pressed }) => [styles.thread, pressed && styles.pressed]}>
        <Avatar
          initials={memberInitials(item.otherFirstName)}
          size={52}
          tone="green"
        />
        <View style={styles.threadContent}>
          <View style={styles.threadHeading}>
            <Text numberOfLines={1} style={styles.threadName}>
              {item.otherFirstName}
            </Text>
            <Text style={styles.timestamp}>{messageTimestamp(item.latestAt)}</Text>
          </View>
          <Text style={styles.context}>Catch Mate · Private message</Text>
          <Text
            numberOfLines={1}
            style={[styles.preview, item.unreadCount > 0 && styles.unreadPreview]}>
            {item.latestBody}
          </Text>
        </View>
        {item.unreadCount ? <UnreadBadge count={item.unreadCount} /> : null}
      </Pressable>
    );
  }
  const people =
    item.type === 'proposal'
      ? `With ${item.otherFirstName}`
      : conversationPeopleLabel(item.otherFirstName);
  const plan = catchPlanTimestamp(item.startsAt ?? item.latestAt);
  return (
    <Pressable
      accessibilityLabel={`${item.title}. ${people}. ${plan}. ${item.latestBody}`}
      onPress={onPress}
      style={({ pressed }) => [styles.thread, pressed && styles.pressed]}>
      <View style={[styles.activityIcon, { backgroundColor: item.activity.color }]}>
        <Text style={styles.emoji}>{item.activity.emoji}</Text>
      </View>
      <View style={styles.threadContent}>
        <View style={styles.threadHeading}>
          <Text numberOfLines={1} style={styles.threadName}>
            {item.title}
          </Text>
          <Text style={styles.timestamp}>{messageTimestamp(item.latestAt)}</Text>
        </View>
        <Text numberOfLines={1} style={styles.context}>
          {people} · {plan}
        </Text>
        <Text style={styles.status}>
          {item.contextLabel} · {item.status.replaceAll('_', ' ')}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.preview, item.unreadCount > 0 && styles.unreadPreview]}>
          {item.latestBody}
        </Text>
      </View>
      {item.unreadCount ? <UnreadBadge count={item.unreadCount} /> : null}
    </Pressable>
  );
}

function UnreadBadge({ count }: { count: number }) {
  return (
    <View style={styles.unread}>
      <Text style={styles.unreadText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  eyebrow: {
    color: colors.orangeDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 15,
    backgroundColor: colors.paper,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.paleOrange,
    padding: 13,
  },
  noticeText: {
    color: colors.orangeDark,
    fontSize: 12,
    fontWeight: '700',
  },
  error: { marginTop: spacing.md, color: colors.error, fontSize: 12, textAlign: 'center' },
  loading: { alignItems: 'center', gap: 9, marginTop: spacing.xl },
  muted: { color: colors.muted, fontSize: 11 },
  list: {
    marginTop: spacing.md,
  },
  thread: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 108,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 15,
  },
  pressed: {
    opacity: 0.76,
  },
  activityIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  emoji: { fontSize: 25 },
  threadContent: {
    flex: 1,
    gap: 2,
  },
  threadHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  threadName: {
    flex: 1,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  timestamp: {
    color: colors.muted,
    fontSize: 11,
  },
  context: {
    color: colors.forest,
    fontSize: 11,
    fontWeight: '700',
  },
  status: {
    color: colors.orangeDark,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  preview: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  unreadPreview: { color: colors.ink, fontWeight: '700' },
  unread: {
    minWidth: 23,
    height: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.orange,
    paddingHorizontal: 5,
  },
  unreadText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
});
