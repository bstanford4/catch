import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Screen } from '@/components/ui/screen';
import { StatePanel } from '@/components/ui/state-panel';
import { colors, radius, spacing } from '@/constants/theme';
import {
  conversationPeopleLabel,
  messageTimestamp,
  validateMessageBody,
} from '@/services/message-utils';
import {
  type MessageThread,
  type MessageThreadType,
  type ThreadMessage,
  listMessageThreads,
  listThreadMessages,
  markMessageThreadRead,
  sendThreadMessage,
  subscribeToThreadMessages,
} from '@/services/messaging-service';

export default function MessageThreadScreen() {
  const params = useLocalSearchParams<{ id: string; type: MessageThreadType }>();
  const router = useRouter();
  const id = params.id ?? '';
  const type =
    params.type === 'proposal' ? 'proposal' : params.type === 'direct' ? 'direct' : 'catch';
  const [thread, setThread] = useState<MessageThread | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [threadResult, messageResult] = await Promise.all([
      listMessageThreads(),
      listThreadMessages(type, id),
    ]);
    setThread(
      threadResult.data.find((item) => item.type === type && item.id === id) ?? null,
    );
    setMessages(messageResult.data);
    setError(threadResult.error ?? messageResult.error ?? '');
    setIsLoading(false);
    if (!messageResult.error) void markMessageThreadRead(type, id);
  }, [id, type]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(
    () =>
      subscribeToThreadMessages(type, id, () => {
        void load();
      }),
    [id, load, type],
  );

  async function send() {
    const validationError = validateMessageBody(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsSending(true);
    setError('');
    const result = await sendThreadMessage(type, id, draft);
    setIsSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDraft('');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await load();
  }

  if (isLoading) {
    return (
      <Screen contentContainerStyle={styles.loading}>
        <ActivityIndicator color={colors.orange} size="large" />
        <Text style={styles.muted}>Loading conversation...</Text>
      </Screen>
    );
  }

  if (!thread) {
    return (
      <Screen>
        <StatePanel
          body={error || 'This conversation is unavailable or you no longer have access.'}
          icon="lock-closed-outline"
          title="Conversation unavailable"
        />
      </Screen>
    );
  }

  const start = thread.startsAt
    ? new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(thread.startsAt))
    : '';
  const people =
    thread.type === 'direct'
      ? `Private conversation with ${thread.otherFirstName}`
      : thread.type === 'proposal'
      ? `With ${thread.otherFirstName}`
      : conversationPeopleLabel(thread.otherFirstName);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}>
      <Screen>
        <Pressable
          accessibilityLabel={
            thread.type === 'direct'
              ? `View ${thread.otherFirstName}'s participant profile`
              : undefined
          }
          disabled={thread.type !== 'direct'}
          onPress={() =>
            router.push({
              pathname: '/member/[id]',
              params: {
                id:
                  thread.type === 'direct'
                    ? thread.otherUserId ?? ''
                    : '',
              },
            })
          }
          style={({ pressed }) => [styles.contextCard, pressed && styles.pressed]}>
          <View style={[styles.activityIcon, { backgroundColor: thread.activity.color }]}>
            <Text style={styles.emoji}>{thread.activity.emoji}</Text>
          </View>
          <View style={styles.contextText}>
            <Text style={styles.eyebrow}>{thread.contextLabel.toUpperCase()}</Text>
            <Text style={styles.title}>{thread.title}</Text>
            <Text style={styles.contextMeta}>
              {thread.type === 'direct'
                ? people
                : `${people} · ${start} · ${thread.status.replaceAll('_', ' ')}`}
            </Text>
          </View>
          {thread.type === 'direct' ? (
            <Ionicons color={colors.muted} name="chevron-forward" size={20} />
          ) : null}
        </Pressable>

        <View style={styles.privacyNotice}>
          <Ionicons color={colors.forest} name="shield-checkmark" size={18} />
          <Text style={styles.privacyText}>
            {thread.type === 'direct'
              ? 'Only connected Catch members can use this private conversation.'
              : 'Keep exact private locations inside this approved conversation.'}
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.messageList}>
          {messages.length === 0 ? (
            <StatePanel
              body={`Say hello to ${thread.otherFirstName} and settle the last details.`}
              icon="chatbubble-ellipses-outline"
              title="Start the conversation"
            />
          ) : (
            messages.map((message) => <MessageBubble item={message} key={message.id} />)
          )}
        </View>

        {thread.canSend ? (
          <View style={styles.composer}>
            <TextInput
              accessibilityLabel="Message"
              maxLength={2000}
              multiline
              onChangeText={setDraft}
              placeholder={
                thread.type === 'direct'
                  ? `Message ${thread.otherFirstName}`
                  : 'Message the Catch crew'
              }
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={draft}
            />
            <Pressable
              accessibilityLabel="Send message"
              disabled={isSending || !draft.trim()}
              onPress={send}
              style={({ pressed }) => [
                styles.sendButton,
                (isSending || !draft.trim()) && styles.sendDisabled,
                pressed && styles.pressed,
              ]}>
              {isSending ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Ionicons color={colors.white} name="arrow-up" size={21} />
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.closed}>
            <Ionicons color={colors.muted} name="lock-closed-outline" size={17} />
            <Text style={styles.closedText}>
              This{' '}
              {thread.type === 'proposal'
                ? 'proposal'
                : thread.type === 'direct'
                  ? 'direct'
                  : 'Catch'}{' '}
              conversation is closed.
            </Text>
          </View>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ item }: { item: ThreadMessage }) {
  if (item.kind === 'system') {
    return (
      <View style={styles.systemMessage}>
        <Ionicons color={colors.forestSoft} name="information-circle-outline" size={15} />
        <Text style={styles.systemText}>{item.body}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.bubbleRow, item.isOwn && styles.ownBubbleRow]}>
      <View style={[styles.bubble, item.isOwn ? styles.ownBubble : styles.otherBubble]}>
        {!item.isOwn ? <Text style={styles.sender}>{item.senderFirstName}</Text> : null}
        <Text style={[styles.body, item.isOwn && styles.ownBody]}>{item.body}</Text>
        <Text style={[styles.time, item.isOwn && styles.ownTime]}>
          {messageTimestamp(item.createdAt)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { color: colors.muted, fontSize: 11 },
  contextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    padding: 14,
  },
  activityIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  emoji: { fontSize: 27 },
  contextText: { flex: 1, gap: 2 },
  eyebrow: { color: colors.orangeDark, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  title: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  contextMeta: { color: colors.muted, fontSize: 11, textTransform: 'capitalize' },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.paleGreen,
    padding: 12,
  },
  privacyText: { flex: 1, color: colors.forest, fontSize: 11, lineHeight: 16 },
  error: { marginTop: spacing.md, color: colors.error, fontSize: 12, textAlign: 'center' },
  messageList: { gap: 9, marginTop: spacing.lg },
  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  ownBubbleRow: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 10 },
  otherBubble: {
    borderWidth: 1,
    borderColor: colors.line,
    borderBottomLeftRadius: 5,
    backgroundColor: colors.paper,
  },
  ownBubble: {
    borderBottomRightRadius: 5,
    backgroundColor: colors.forest,
  },
  sender: { marginBottom: 3, color: colors.orangeDark, fontSize: 10, fontWeight: '900' },
  body: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  ownBody: { color: colors.white },
  time: { marginTop: 4, color: colors.muted, fontSize: 9, textAlign: 'right' },
  ownTime: { color: colors.paleGreen },
  systemMessage: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.paleGreen,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  systemText: { color: colors.forestSoft, fontSize: 10, fontWeight: '700' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 9,
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.paper,
    color: colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  sendButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.orange,
  },
  sendDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.78 },
  closed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  closedText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
});
