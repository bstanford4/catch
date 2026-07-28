import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { StatePanel } from '@/components/ui/state-panel';
import { colors, radius, shadows, spacing } from '@/constants/theme';
import {
  type DirectCatchProposal,
  decideDirectCatchProposal,
  listDirectCatchProposals,
  withdrawDirectCatchProposal,
} from '@/services/catch-mate-service';

export default function ProposalsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<DirectCatchProposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    const result = await listDirectCatchProposals();
    setItems(result.data);
    setError(result.error ?? '');
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function decide(item: DirectCatchProposal, approve: boolean) {
    setSavingId(item.id);
    setError('');
    const result = await decideDirectCatchProposal(item.id, approve);
    setSavingId('');
    if (result.error) {
      setError(result.error);
      return;
    }
    setItems((current) =>
      current.map((proposal) =>
        proposal.id === item.id
          ? {
              ...proposal,
              acceptedCatchId: result.data,
              status: approve ? 'accepted' : 'declined',
            }
          : proposal,
      ),
    );
  }

  async function withdraw(item: DirectCatchProposal) {
    setSavingId(item.id);
    const result = await withdrawDirectCatchProposal(item.id);
    setSavingId('');
    if (result.error) {
      setError(result.error);
      return;
    }
    setItems((current) =>
      current.map((proposal) =>
        proposal.id === item.id ? { ...proposal, status: 'withdrawn' } : proposal,
      ),
    );
  }

  const pending = items.filter((item) => item.status === 'pending');
  const history = items.filter((item) => item.status !== 'pending');

  return (
    <Screen>
      <Text style={styles.eyebrow}>MAKE A PLAN</Text>
      <Text style={styles.title}>Catch proposals</Text>
      <Text style={styles.subtitle}>Simple invitations between people who already connected.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.orange} />
          <Text style={styles.muted}>Loading proposals...</Text>
        </View>
      ) : null}
      {!isLoading && items.length === 0 ? (
        <StatePanel
          action="Open Catch Mates"
          body="Choose a saved mate and send them a time, activity, and broad meeting area."
          icon="paper-plane-outline"
          onAction={() => router.push('/catch-mates')}
          title="No proposals yet"
        />
      ) : null}
      {pending.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending</Text>
          {pending.map((item) => (
            <ProposalCard
              busy={savingId === item.id}
              item={item}
              key={item.id}
              onAccept={
                item.direction === 'received' ? () => decide(item, true) : undefined
              }
              onDecline={
                item.direction === 'received' ? () => decide(item, false) : undefined
              }
              onWithdraw={item.direction === 'sent' ? () => withdraw(item) : undefined}
            />
          ))}
        </View>
      ) : null}
      {history.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>History</Text>
          {history.map((item) => (
            <ProposalCard
              item={item}
              key={item.id}
              onView={
                item.acceptedCatchId
                  ? () =>
                      router.push({
                        pathname: '/catch/[id]',
                        params: { id: item.acceptedCatchId! },
                      })
                  : undefined
              }
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function ProposalCard({
  busy = false,
  item,
  onAccept,
  onDecline,
  onView,
  onWithdraw,
}: {
  busy?: boolean;
  item: DirectCatchProposal;
  onAccept?: () => void;
  onDecline?: () => void;
  onView?: () => void;
  onWithdraw?: () => void;
}) {
  const start = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(item.startsAt));
  return (
    <View style={styles.card}>
      <View style={[styles.activityIcon, { backgroundColor: item.activity.color }]}>
        <Text style={styles.emoji}>{item.activity.emoji}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.direction}>
            {item.direction === 'received' ? `FROM ${item.otherFirstName.toUpperCase()}` : `TO ${item.otherFirstName.toUpperCase()}`}
          </Text>
          <Text style={[styles.status, item.status === 'accepted' && styles.accepted]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.cardTitle}>{item.activity.name} with {item.otherFirstName}</Text>
        <View style={styles.metaRow}>
          <Ionicons color={colors.forestSoft} name="time-outline" size={15} />
          <Text style={styles.meta}>{start} · {item.durationMinutes} min</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons color={colors.forestSoft} name="location-outline" size={15} />
          <Text style={styles.meta}>{item.venueName ?? `${item.areaLabel} · exact spot later`}</Text>
        </View>
        {item.message ? <Text style={styles.message}>&ldquo;{item.message}&rdquo;</Text> : null}
        {onAccept && onDecline ? (
          <View style={styles.actions}>
            <Pressable
              disabled={busy}
              onPress={onDecline}
              style={({ pressed }) => [styles.declineButton, pressed && styles.pressed]}>
              <Text style={styles.declineText}>Decline</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={onAccept}
              style={({ pressed }) => [styles.acceptButton, pressed && styles.pressed]}>
              <Ionicons color={colors.white} name="checkmark" size={17} />
              <Text style={styles.acceptText}>{busy ? 'Saving...' : 'Accept'}</Text>
            </Pressable>
          </View>
        ) : null}
        {onWithdraw ? (
          <Pressable disabled={busy} onPress={onWithdraw} style={styles.withdrawButton}>
            <Text style={styles.declineText}>{busy ? 'Withdrawing...' : 'Withdraw proposal'}</Text>
          </Pressable>
        ) : null}
        {onView ? (
          <Pressable
            onPress={onView}
            style={({ pressed }) => [styles.viewButton, pressed && styles.pressed]}>
            <Text style={styles.viewText}>View accepted Catch</Text>
            <Ionicons color={colors.forest} name="arrow-forward" size={16} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: { marginTop: spacing.sm, color: colors.orangeDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 31, fontWeight: '900' },
  subtitle: { marginTop: 4, color: colors.muted, fontSize: 13 },
  loading: { alignItems: 'center', gap: 9, marginTop: spacing.xl },
  muted: { color: colors.muted, fontSize: 11 },
  error: { marginTop: spacing.md, color: colors.error, fontSize: 13, textAlign: 'center' },
  section: { gap: 11, marginTop: spacing.xl },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    padding: 13,
    ...shadows.card,
  },
  activityIcon: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  emoji: { fontSize: 25 },
  cardBody: { flex: 1, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  direction: { color: colors.orangeDark, fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  status: {
    borderRadius: radius.pill,
    backgroundColor: colors.paleOrange,
    color: colors.orangeDark,
    fontSize: 8,
    fontWeight: '900',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  accepted: { backgroundColor: colors.paleGreen, color: colors.forest },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 16 },
  message: { color: colors.ink, fontSize: 11, lineHeight: 16, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 9, marginTop: 4 },
  declineButton: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 42 },
  declineText: { color: colors.error, fontSize: 11, fontWeight: '800' },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 42,
    borderRadius: 13,
    backgroundColor: colors.forest,
  },
  acceptText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  withdrawButton: { alignItems: 'center', minHeight: 38, justifyContent: 'center' },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 42,
    borderRadius: 13,
    backgroundColor: colors.paleGreen,
  },
  viewText: { color: colors.forest, fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.75 },
});
