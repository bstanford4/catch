import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { StatePanel } from '@/components/ui/state-panel';
import { colors, radius, shadows, spacing } from '@/constants/theme';
import {
  type CatchMatchNotification,
  listCatchMatchNotifications,
  markCatchMatchNotificationRead,
} from '@/services/matching-service';

export default function CatchMatchesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<CatchMatchNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    const result = await listCatchMatchNotifications();
    setItems(result.data);
    setError(result.error ?? '');
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function open(item: CatchMatchNotification) {
    if (!item.readAt) {
      const result = await markCatchMatchNotificationRead(item.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id ? { ...candidate, readAt: new Date().toISOString() } : candidate,
        ),
      );
    }
    router.push({ pathname: '/catch/[id]', params: { id: item.catchId } });
  }

  const unread = items.filter((item) => !item.readAt).length;

  return (
    <Screen>
      <Text style={styles.eyebrow}>GOOD TIMING</Text>
      <Text style={styles.title}>Catches for you</Text>
      <Text style={styles.subtitle}>
        These plans match your saved activities, availability, and broad area.
      </Text>
      {unread ? <Text style={styles.unreadLabel}>{unread} NEW</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.orange} />
          <Text style={styles.muted}>Checking for matches...</Text>
        </View>
      ) : null}
      {!isLoading && items.length === 0 ? (
        <StatePanel
          body="When someone nearby posts a Catch that fits your activities and broad availability, it will appear here."
          icon="notifications-outline"
          title="No matching Catches yet"
        />
      ) : null}
      {items.length ? (
        <View style={styles.list}>
          {items.map((item) => {
            const start = new Intl.DateTimeFormat('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            }).format(new Date(item.startsAt));
            return (
              <Pressable
                accessibilityLabel={`${item.catchTitle} hosted by ${item.hostFirstName}`}
                key={item.id}
                onPress={() => open(item)}
                style={({ pressed }) => [
                  styles.card,
                  !item.readAt && styles.unreadCard,
                  pressed && styles.pressed,
                ]}>
                <View style={[styles.activityIcon, { backgroundColor: item.activity.color }]}>
                  <Text style={styles.emoji}>{item.activity.emoji}</Text>
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text style={styles.reason}>MATCHED YOUR AVAILABILITY</Text>
                    {!item.readAt ? <View style={styles.newDot} /> : null}
                  </View>
                  <Text style={styles.cardTitle}>
                    {item.hostFirstName} set up a {item.activity.name} Catch
                  </Text>
                  <Text style={styles.meta}>{start} · {item.durationMinutes} min</Text>
                  <View style={styles.locationRow}>
                    <Ionicons
                      color={colors.forestSoft}
                      name={item.locationType === 'private' ? 'shield-checkmark-outline' : 'location-outline'}
                      size={14}
                    />
                    <Text style={styles.meta}>
                      {item.locationType === 'private'
                        ? `Private spot near ${item.areaLabel}`
                        : item.areaLabel}
                    </Text>
                  </View>
                  <Text style={styles.joinText}>See the plan and request to join</Text>
                </View>
                <Ionicons color={colors.muted} name="chevron-forward" size={19} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <View style={styles.privacy}>
        <Ionicons color={colors.forest} name="shield-checkmark" size={18} />
        <Text style={styles.privacyText}>
          Match alerts never include a private address. Device push delivery will use these same
          privacy-safe records later.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { marginTop: spacing.sm, color: colors.orangeDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 31, fontWeight: '900' },
  subtitle: { marginTop: 4, color: colors.muted, fontSize: 13, lineHeight: 19 },
  unreadLabel: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.paleOrange,
    color: colors.orangeDark,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  loading: { alignItems: 'center', gap: 9, marginTop: spacing.xl },
  muted: { color: colors.muted, fontSize: 11 },
  error: { marginTop: spacing.md, color: colors.error, fontSize: 13, textAlign: 'center' },
  list: { gap: 11, marginTop: spacing.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    padding: 13,
    ...shadows.card,
  },
  unreadCard: { borderColor: colors.orange, backgroundColor: '#FFF9F2' },
  activityIcon: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  emoji: { fontSize: 25 },
  cardBody: { flex: 1, gap: 3 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reason: { color: colors.orangeDark, fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  newDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.orange },
  cardTitle: { color: colors.ink, fontSize: 15, fontWeight: '900', lineHeight: 20 },
  meta: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  joinText: { marginTop: 2, color: colors.forest, fontSize: 10, fontWeight: '800' },
  privacy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.paleGreen,
    padding: 12,
  },
  privacyText: { flex: 1, color: colors.forest, fontSize: 10, lineHeight: 15 },
  pressed: { opacity: 0.75 },
});
