import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { StatePanel } from '@/components/ui/state-panel';
import { colors, radius, shadows, spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import {
  type ReceivedFeedback,
  type SharedFeedbackVisibility,
  listReceivedFeedback,
  setSharedFeedbackVisibility,
} from '@/services/shared-feedback-service';

export default function SharedFeedbackScreen() {
  const { session } = useAuth();
  const [items, setItems] = useState<ReceivedFeedback[]>([]);
  const [savingId, setSavingId] = useState('');
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    const result = await listReceivedFeedback();
    setItems(result.data);
    setError(result.error ?? '');
    setIsLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function choose(item: ReceivedFeedback, visibility: SharedFeedbackVisibility) {
    setSavingId(item.feedbackId);
    setError('');
    const result = await setSharedFeedbackVisibility(item.feedbackId, visibility);
    setSavingId('');
    if (result.error) {
      setError(result.error);
      return;
    }
    setItems((current) =>
      current.map((entry) =>
        entry.feedbackId === item.feedbackId ? { ...entry, visibility } : entry,
      ),
    );
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  if (!session) {
    return (
      <Screen>
        <StatePanel body="Sign in to view feedback shared with you." icon="person-outline" title="Sign in first" />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.eyebrow}>YOUR PRIVATE FEEDBACK</Text>
      <Text style={styles.title}>Notes from Catch Mates</Text>
      <Text style={styles.subtitle}>
        These notes are private by default. You—not the writer—decide whether a quote appears anonymously on your profile.
      </Text>

      <View style={styles.safetyCard}>
        <Ionicons color={colors.forest} name="shield-checkmark" size={23} />
        <Text style={styles.safetyText}>
          Featuring a note never reveals who wrote it. If its author edits the wording later, it automatically returns to private until you approve it again.
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.orange} size="large" />
          <Text style={styles.muted}>Opening your feedback...</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!isLoading && !error && !items.length ? (
        <StatePanel
          body="When a Catch Mate intentionally shares a note after a completed Catch, it will appear here."
          icon="heart-outline"
          title="No shared notes yet"
        />
      ) : null}

      <View style={styles.list}>
        {items.map((item) => (
          <View key={item.feedbackId} style={[styles.card, item.visibility === 'hidden' && styles.hiddenCard]}>
            <View style={styles.cardHeading}>
              <View style={styles.quoteIcon}>
                <Ionicons color={colors.orangeDark} name="chatbubble-ellipses-outline" size={21} />
              </View>
              <View style={styles.cardHeadingText}>
                <Text style={styles.author}>{item.authorName} shared this with you</Text>
                <Text style={styles.catchLabel}>{item.catchTitle} · {formatDate(item.startsAt)}</Text>
              </View>
              <VisibilityBadge value={item.visibility} />
            </View>
            <Text style={styles.quote}>“{item.sharedNote}”</Text>
            <Text style={styles.helper}>
              {item.visibility === 'featured'
                ? 'This quote is currently featured anonymously on your profile.'
                : item.visibility === 'hidden'
                  ? 'Hidden from your profile and visually tucked away here.'
                  : 'Only you can see this note right now.'}
            </Text>
            <View style={styles.actions}>
              <FeedbackAction
                disabled={savingId === item.feedbackId}
                icon="lock-closed-outline"
                label="Keep private"
                onPress={() => choose(item, 'private')}
                selected={item.visibility === 'private'}
              />
              <FeedbackAction
                disabled={savingId === item.feedbackId}
                icon="person-circle-outline"
                label="Feature"
                onPress={() => choose(item, 'featured')}
                selected={item.visibility === 'featured'}
              />
              <FeedbackAction
                disabled={savingId === item.feedbackId}
                icon="eye-off-outline"
                label="Hide"
                onPress={() => choose(item, 'hidden')}
                selected={item.visibility === 'hidden'}
              />
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

function FeedbackAction({
  disabled,
  icon,
  label,
  onPress,
  selected,
}: {
  disabled: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, selected && styles.actionSelected]}>
      <Ionicons color={selected ? colors.white : colors.forest} name={icon} size={17} />
      <Text style={[styles.actionText, selected && styles.actionTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function VisibilityBadge({ value }: { value: SharedFeedbackVisibility }) {
  return (
    <View style={[styles.badge, value === 'featured' && styles.featuredBadge]}>
      <Text style={styles.badgeText}>{value.toUpperCase()}</Text>
    </View>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

const styles = StyleSheet.create({
  eyebrow: { marginTop: spacing.sm, color: colors.orangeDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  subtitle: { marginTop: 4, color: colors.muted, fontSize: 13, lineHeight: 20 },
  safetyCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.paleGreen, padding: spacing.md },
  safetyText: { flex: 1, color: colors.forest, fontSize: 11, lineHeight: 17 },
  loading: { alignItems: 'center', gap: 9, paddingVertical: spacing.xl },
  muted: { color: colors.muted, fontSize: 11 },
  error: { marginTop: spacing.md, color: colors.error, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  list: { gap: 13, marginTop: spacing.lg },
  card: { gap: 11, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: colors.paper, padding: spacing.md, ...shadows.card },
  hiddenCard: { opacity: 0.72 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  quoteIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.paleOrange },
  cardHeadingText: { flex: 1, gap: 2 },
  author: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  catchLabel: { color: colors.muted, fontSize: 9, lineHeight: 14 },
  badge: { borderRadius: radius.pill, backgroundColor: colors.cream, paddingHorizontal: 7, paddingVertical: 4 },
  featuredBadge: { backgroundColor: colors.paleGreen },
  badgeText: { color: colors.forest, fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  quote: { color: colors.ink, fontSize: 15, lineHeight: 22, fontStyle: 'italic' },
  helper: { color: colors.muted, fontSize: 9, lineHeight: 14 },
  actions: { flexDirection: 'row', gap: 7 },
  action: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', gap: 3, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.cream, paddingHorizontal: 4 },
  actionSelected: { borderColor: colors.forest, backgroundColor: colors.forest },
  actionText: { color: colors.forest, fontSize: 8, fontWeight: '900', textAlign: 'center' },
  actionTextSelected: { color: colors.white },
});
