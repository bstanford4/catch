import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { StatePanel } from '@/components/ui/state-panel';
import { colors, radius, shadows, spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import {
  type CatchHistoryItem,
  listMyCatchHistory,
} from '@/services/catch-history-service';
import {
  type PastCatchConfirmation,
  listPastCatchConfirmations,
  respondToPastCatchConfirmation,
} from '@/services/past-catch-service';

export default function CatchHistoryScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [items, setItems] = useState<CatchHistoryItem[]>([]);
  const [confirmations, setConfirmations] = useState<PastCatchConfirmation[]>([]);
  const [respondingId, setRespondingId] = useState('');
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);
    setError('');
    const [historyResult, confirmationResult] = await Promise.all([
      listMyCatchHistory(),
      listPastCatchConfirmations(),
    ]);
    setItems(historyResult.data);
    setConfirmations(confirmationResult.data);
    setError(historyResult.error ?? confirmationResult.error ?? '');
    setIsLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function respond(confirmation: PastCatchConfirmation, approve: boolean) {
    setRespondingId(confirmation.id);
    setError('');
    const result = await respondToPastCatchConfirmation(confirmation.id, approve);
    setRespondingId('');
    if (result.error) {
      setError(result.error);
      return;
    }
    await load();
  }

  return (
    <Screen>
      <Text style={styles.eyebrow}>YOUR TIME WELL SPENT</Text>
      <Text style={styles.title}>Catch History</Text>
      <Text style={styles.subtitle}>
        Every completed Catch you hosted or joined, with its original crew album.
      </Text>

      <View style={styles.oneAlbumCard}>
        <Ionicons color={colors.forest} name="images-outline" size={24} />
        <Text style={styles.oneAlbumText}>
          One album, one upload. A photo stays attached to its Catch and can optionally appear in Catch Highlights without uploading it again.
        </Text>
      </View>

      {session ? (
        <Pressable
          accessibilityLabel="Log a Catch that already happened"
          onPress={() => router.push('/log-past-catch')}
          style={({ pressed }) => [styles.logPastButton, pressed && styles.pressed]}>
          <View style={styles.logPastIcon}>
            <Ionicons color={colors.orangeDark} name="time-outline" size={23} />
          </View>
          <View style={styles.logPastText}>
            <Text style={styles.logPastTitle}>Had an impromptu Catch?</Text>
            <Text style={styles.logPastBody}>Log a past Catch and add its photos whenever you like.</Text>
          </View>
          <Ionicons color={colors.forest} name="arrow-forward" size={20} />
        </Pressable>
      ) : null}

      {confirmations.length ? (
        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationEyebrow}>WERE YOU THERE?</Text>
          <Text style={styles.confirmationTitle}>Confirm a past Catch</Text>
          <Text style={styles.confirmationBody}>
            It joins your history only if you confirm it.
          </Text>
          {confirmations.map((confirmation) => (
            <View key={confirmation.id} style={styles.confirmationCard}>
              <View style={[styles.confirmationEmoji, { backgroundColor: confirmation.activityColor }]}>
                <Text style={styles.emoji}>{confirmation.activityEmoji}</Text>
              </View>
              <View style={styles.confirmationContent}>
                <Text style={styles.confirmationHost}>{confirmation.hostName} says you joined</Text>
                <Text style={styles.confirmationCatch}>{confirmation.title}</Text>
                <Text style={styles.confirmationDetails}>
                  {formatCatchDate(confirmation.startsAt)} · {confirmation.locationLabel}
                </Text>
                <View style={styles.confirmationActions}>
                  <Pressable
                    disabled={Boolean(respondingId)}
                    onPress={() => respond(confirmation, true)}
                    style={styles.confirmButton}>
                    <Text style={styles.confirmButtonText}>
                      {respondingId === confirmation.id ? 'Saving…' : 'Yes, I was there'}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={Boolean(respondingId)}
                    onPress={() => respond(confirmation, false)}
                    style={styles.declineButton}>
                    <Text style={styles.declineButtonText}>Not me</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {!session ? (
        <StatePanel
          body="Sign in to revisit Catches you hosted or joined."
          icon="person-outline"
          title="Sign in to see your history"
        />
      ) : null}
      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.orange} size="large" />
          <Text style={styles.muted}>Opening your Catch history…</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {session && !isLoading && !error && !items.length && !confirmations.length ? (
        <StatePanel
          body="After a host marks a Catch complete, it will appear here for everyone in the approved crew."
          icon="time-outline"
          title="Your first memory is ahead"
        />
      ) : null}

      <View style={styles.list}>
        {items.map((item) => (
          <HistoryCard
            item={item}
            key={item.catchId}
            onOpenMemories={() => router.push(`/catch-memories/${item.catchId}` as never)}
            onReview={() => router.push(`/post-catch-review/${item.catchId}` as never)}
          />
        ))}
      </View>
    </Screen>
  );
}

function HistoryCard({
  item,
  onOpenMemories,
  onReview,
}: {
  item: CatchHistoryItem;
  onOpenMemories: () => void;
  onReview: () => void;
}) {
  const totalMemories = item.photoCount + item.videoCount;
  const reviewComplete =
    item.reviewEligibleCount > 0 && item.reviewCompletedCount >= item.reviewEligibleCount;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeading}>
        <View style={[styles.activityIcon, { backgroundColor: item.activityColor }]}>
          <Text style={styles.emoji}>{item.activityEmoji}</Text>
        </View>
        <View style={styles.cardHeadingText}>
          <View style={styles.cardMetaRow}>
            <Text style={styles.date}>{formatCatchDate(item.startsAt)}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{item.memberRole === 'host' ? 'HOSTED' : 'JOINED'}</Text>
            </View>
          </View>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.activityName}>{item.activityName}</Text>
        </View>
      </View>

      <View style={styles.detailRow}>
        <Ionicons color={colors.forest} name="location-outline" size={17} />
        <Text style={styles.detailText}>{item.locationLabel}</Text>
      </View>
      <View style={styles.detailRow}>
        <Ionicons color={colors.forest} name="people-outline" size={17} />
        <Text numberOfLines={2} style={styles.detailText}>
          {formatCrew(item.participantNames)}
        </Text>
      </View>

      {item.previewUrls.length ? (
        <View style={styles.previewRow}>
          {item.previewUrls.map((url) => (
            <Image contentFit="cover" key={url} source={url} style={styles.preview} transition={180} />
          ))}
        </View>
      ) : (
        <View style={styles.emptyPreview}>
          <Ionicons color={colors.muted} name="camera-outline" size={22} />
          <Text style={styles.emptyPreviewText}>No photos yet—add them anytime.</Text>
        </View>
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.memoryCount}>
          {totalMemories
            ? `${item.photoCount} ${item.photoCount === 1 ? 'photo' : 'photos'}${
                item.videoCount ? ` · ${item.videoCount} ${item.videoCount === 1 ? 'video' : 'videos'}` : ''
              }`
            : 'Album ready'}
        </Text>
        <Pressable accessibilityLabel={`Open memories for ${item.title}`} onPress={onOpenMemories} style={styles.openAction}>
          <Text style={styles.openActionText}>Open memories</Text>
          <Ionicons color={colors.orangeDark} name="arrow-forward" size={17} />
        </Pressable>
      </View>
      {item.reviewEligibleCount > 0 ? (
        <Pressable
          accessibilityLabel={`${reviewComplete ? 'Update' : 'Complete'} post-Catch review for ${item.title}`}
          onPress={onReview}
          style={[styles.reviewAction, reviewComplete && styles.reviewActionComplete]}>
          <View style={styles.reviewActionText}>
            <Text style={styles.reviewTitle}>{reviewComplete ? 'Review saved' : 'How did it go?'}</Text>
            <Text style={styles.reviewBody}>
              {reviewComplete
                ? 'Return anytime to update your post-Catch review.'
                : `Review ${item.reviewEligibleCount - item.reviewCompletedCount} Catch ${item.reviewEligibleCount - item.reviewCompletedCount === 1 ? 'Mate' : 'Mates'}.`}
            </Text>
          </View>
          <Ionicons color={colors.forest} name={reviewComplete ? 'checkmark-circle' : 'clipboard-outline'} size={23} />
        </Pressable>
      ) : null}
    </View>
  );
}

function formatCatchDate(value: string) {
  const date = new Date(value);
  const includeYear = date.getFullYear() !== new Date().getFullYear();
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: includeYear ? 'numeric' : undefined,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatCrew(names: string[]) {
  const unique = [...new Set(names.filter(Boolean))];
  if (!unique.length) return 'Your Catch crew';
  if (unique.length <= 3) return unique.join(', ').replace(/, ([^,]*)$/, ' & $1');
  return `${unique.slice(0, 2).join(', ')} & ${unique.length - 2} others`;
}

const styles = StyleSheet.create({
  eyebrow: { marginTop: spacing.sm, color: colors.orangeDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  subtitle: { marginTop: 4, color: colors.muted, fontSize: 14, lineHeight: 20 },
  oneAlbumCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginTop: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.paleGreen, padding: spacing.md },
  oneAlbumText: { flex: 1, color: colors.forest, fontSize: 12, lineHeight: 18 },
  logPastButton: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 12, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: colors.paper, padding: 13, ...shadows.card },
  logPastIcon: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.paleOrange },
  logPastText: { flex: 1, gap: 2 },
  logPastTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  logPastBody: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  confirmationSection: { gap: 8, marginTop: spacing.xl },
  confirmationEyebrow: { color: colors.orangeDark, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  confirmationTitle: { color: colors.ink, fontSize: 21, fontWeight: '900' },
  confirmationBody: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  confirmationCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginTop: 4, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: colors.paper, padding: 13 },
  confirmationEmoji: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  confirmationContent: { flex: 1, gap: 2 },
  confirmationHost: { color: colors.orangeDark, fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  confirmationCatch: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  confirmationDetails: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  confirmationActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  confirmButton: { minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.forest, paddingHorizontal: 12 },
  confirmButtonText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  declineButton: { minHeight: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12 },
  declineButtonText: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  loading: { alignItems: 'center', gap: 10, paddingVertical: spacing.xl },
  muted: { color: colors.muted, fontSize: 12 },
  error: { marginTop: spacing.md, color: colors.error, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  list: { gap: 16, marginTop: spacing.lg },
  card: { gap: 11, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: colors.paper, padding: spacing.md, ...shadows.card },
  pressed: { opacity: 0.8 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  activityIcon: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  emoji: { fontSize: 28 },
  cardHeadingText: { flex: 1, gap: 2 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  date: { flexShrink: 1, color: colors.orangeDark, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  roleBadge: { borderRadius: 99, backgroundColor: colors.paleGreen, paddingHorizontal: 8, paddingVertical: 4 },
  roleText: { color: colors.forest, fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  cardTitle: { color: colors.ink, fontSize: 19, fontWeight: '900', letterSpacing: -0.3 },
  activityName: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  detailText: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 17 },
  previewRow: { height: 145, flexDirection: 'row', gap: 7 },
  preview: { flex: 1, height: '100%', borderRadius: radius.md, backgroundColor: colors.ink },
  emptyPreview: { minHeight: 78, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md, backgroundColor: colors.cream },
  emptyPreviewText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  memoryCount: { flexShrink: 1, color: colors.muted, fontSize: 10, fontWeight: '700' },
  openAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  openActionText: { color: colors.orangeDark, fontSize: 11, fontWeight: '900' },
  reviewAction: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.md, backgroundColor: colors.paleOrange, padding: 12 },
  reviewActionComplete: { backgroundColor: colors.paleGreen },
  reviewActionText: { flex: 1, gap: 2 },
  reviewTitle: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  reviewBody: { color: colors.muted, fontSize: 9, lineHeight: 14 },
});
