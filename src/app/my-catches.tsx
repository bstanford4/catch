import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { StatePanel } from '@/components/ui/state-panel';
import { colors, radius, shadows, spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import {
  cancelCatch,
  type HostedCatch,
  listHostedCatches,
} from '@/services/catch-service';

const inactiveStatuses = new Set(['completed', 'canceled', 'expired']);

function isActiveCatch(item: HostedCatch) {
  const endsAt = new Date(item.startsAt).getTime() + item.durationMinutes * 60_000;
  return !inactiveStatuses.has(item.status) && endsAt > Date.now();
}

export default function MyCatchesScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [items, setItems] = useState<HostedCatch[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [error, setError] = useState('');
  const [confirmCancelId, setConfirmCancelId] = useState('');
  const [cancelingId, setCancelingId] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    setError('');
    const result = await listHostedCatches(session.user.id);
    if (result.error) setError(result.error);
    setItems(result.data);
    setIsLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function cancel(item: HostedCatch) {
    if (!session) return;
    if (confirmCancelId !== item.id) {
      setConfirmCancelId(item.id);
      return;
    }
    setCancelingId(item.id);
    setError('');
    const result = await cancelCatch(item.id, session.user.id);
    setCancelingId('');
    setConfirmCancelId('');
    if (result.error) {
      setError(result.error);
      return;
    }
    setItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id ? { ...candidate, status: 'canceled' } : candidate,
      ),
    );
  }

  const active = items.filter(isActiveCatch);
  const history = items.filter((item) => !isActiveCatch(item));

  return (
    <Screen>
      <View style={styles.headingRow}>
        <View style={styles.headingText}>
          <Text style={styles.eyebrow}>HOST BOARD</Text>
          <Text style={styles.title}>My Catches</Text>
          <Text style={styles.subtitle}>Plans you created, all in one place.</Text>
        </View>
        <Pressable
          accessibilityLabel="Create a Catch"
          onPress={() => router.push('/(tabs)/create')}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
          <Ionicons color={colors.white} name="add" size={25} />
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.orange} size="large" />
          <Text style={styles.loadingText}>Checking the board…</Text>
        </View>
      ) : null}

      {!isLoading && !session ? (
        <StatePanel
          body="Create an account to save and manage real catches."
          icon="person-outline"
          title="Sign in to host"
        />
      ) : null}

      {!isLoading && session && items.length === 0 ? (
        <StatePanel
          action="Create your first Catch"
          body="Post something casual now or put a plan on the calendar."
          icon="calendar-outline"
          onAction={() => router.push('/(tabs)/create')}
          title="Your board is wide open"
        />
      ) : null}

      {active.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active plans</Text>
          <View style={styles.list}>
            {active.map((item) => (
              <HostedCatchCard
                canceling={cancelingId === item.id}
                confirmingCancel={confirmCancelId === item.id}
                item={item}
                key={item.id}
                onCancel={() => cancel(item)}
                onEdit={() =>
                  router.push({
                    pathname: '/create/[mode]',
                    params: { catchId: item.id, mode: item.kind },
                  })
                }
              />
            ))}
          </View>
        </View>
      ) : null}

      {history.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>History</Text>
          <View style={styles.list}>
            {history.map((item) => (
              <HostedCatchCard item={item} key={item.id} />
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function HostedCatchCard({
  canceling = false,
  confirmingCancel = false,
  item,
  onCancel,
  onEdit,
}: {
  canceling?: boolean;
  confirmingCancel?: boolean;
  item: HostedCatch;
  onCancel?: () => void;
  onEdit?: () => void;
}) {
  const startLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(item.startsAt));
  const active = isActiveCatch(item);
  const statusLabel = !active && item.status === 'open' ? 'PAST' : item.status.toUpperCase();

  return (
    <View style={[styles.card, !active && styles.inactiveCard]}>
      <View style={[styles.activityIcon, { backgroundColor: item.activity.color }]}>
        <Text style={styles.emoji}>{item.activity.emoji}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.kind}>{item.kind === 'now' ? 'CATCH NOW' : 'SCHEDULED'}</Text>
          <Text style={[styles.status, item.status === 'canceled' && styles.canceledStatus]}>
            {statusLabel}
          </Text>
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <View style={styles.metaRow}>
          <Ionicons color={colors.forestSoft} name="sparkles-outline" size={15} />
          <Text style={styles.meta}>{item.customActivityName ?? item.activity.name}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons color={colors.forestSoft} name="time-outline" size={15} />
          <Text style={styles.meta}>{startLabel} · {item.durationMinutes} min</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons color={colors.forestSoft} name="location-outline" size={15} />
          <Text numberOfLines={1} style={styles.meta}>
            {item.customVenueName ?? item.venue?.name ?? item.customVenueArea ?? 'Venue unavailable'}{' '}
            · {item.capacity} people
          </Text>
        </View>
        {active && onEdit && onCancel ? (
          <View style={styles.actions}>
            <Button icon="pencil-outline" label="Edit" onPress={onEdit} variant="secondary" />
            <Pressable
              accessibilityRole="button"
              disabled={canceling}
              onPress={onCancel}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
              <Text style={styles.cancelText}>
                {canceling ? 'Canceling…' : confirmingCancel ? 'Confirm cancel' : 'Cancel Catch'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginTop: spacing.md },
  headingText: { flex: 1 },
  eyebrow: { color: colors.orangeDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 31, fontWeight: '900', letterSpacing: -1 },
  subtitle: { marginTop: 3, color: colors.muted, fontSize: 13 },
  addButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: colors.orange,
    ...shadows.card,
  },
  loading: { alignItems: 'center', gap: 10, marginTop: spacing.xxl },
  loadingText: { color: colors.muted, fontSize: 12 },
  error: { marginVertical: spacing.md, color: colors.error, fontSize: 13, textAlign: 'center' },
  section: { gap: 11, marginTop: spacing.xl },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  list: { gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    padding: 13,
    ...shadows.card,
  },
  inactiveCard: { opacity: 0.68 },
  activityIcon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
  },
  emoji: { fontSize: 27 },
  cardBody: { flex: 1, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kind: { color: colors.orangeDark, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  status: {
    borderRadius: radius.pill,
    backgroundColor: colors.paleGreen,
    color: colors.forest,
    fontSize: 8,
    fontWeight: '900',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  canceledStatus: { backgroundColor: colors.paleOrange, color: colors.error },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { flex: 1, color: colors.muted, fontSize: 11 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 5 },
  cancelButton: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  cancelText: { color: colors.error, fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.75 },
});
