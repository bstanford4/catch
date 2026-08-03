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

export default function CatchHistoryScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [items, setItems] = useState<CatchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);
    setError('');
    const result = await listMyCatchHistory();
    setItems(result.data);
    setError(result.error ?? '');
    setIsLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

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
      {session && !isLoading && !error && !items.length ? (
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
            onPress={() => router.push(`/catch-memories/${item.catchId}` as never)}
          />
        ))}
      </View>
    </Screen>
  );
}

function HistoryCard({ item, onPress }: { item: CatchHistoryItem; onPress: () => void }) {
  const totalMemories = item.photoCount + item.videoCount;
  return (
    <Pressable
      accessibilityLabel={`Open memories for ${item.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
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
        <View style={styles.openAction}>
          <Text style={styles.openActionText}>Open memories</Text>
          <Ionicons color={colors.orangeDark} name="arrow-forward" size={17} />
        </View>
      </View>
    </Pressable>
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
});
