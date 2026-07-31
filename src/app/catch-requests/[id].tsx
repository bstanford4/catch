import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { StatePanel } from '@/components/ui/state-panel';
import { colors, radius, shadows, spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { saveCatchMate } from '@/services/catch-mate-service';
import {
  type HostedCatch,
  type JoinRequest,
  decideJoinRequest,
  getHostedCatch,
  listHostJoinRequests,
} from '@/services/catch-service';
import { memberInitials } from '@/utils/member-name';

export default function CatchRequestsScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [catchItem, setCatchItem] = useState<HostedCatch | null>(null);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [decidingId, setDecidingId] = useState('');
  const [savedMateIds, setSavedMateIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);
    const [catchResult, requestResult] = await Promise.all([
      getHostedCatch(id, session.user.id),
      listHostJoinRequests(id),
    ]);
    setCatchItem(catchResult.data);
    setRequests(requestResult.data);
    setError(catchResult.error ?? requestResult.error ?? '');
    setIsLoading(false);
  }, [id, session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function decide(request: JoinRequest, approve: boolean) {
    setDecidingId(request.id);
    setError('');
    const result = await decideJoinRequest(request.id, approve);
    setDecidingId('');
    if (result.error || !result.data) {
      setError(result.error ?? 'The request could not be updated.');
      return;
    }
    setRequests((current) =>
      current.map((item) => (item.id === request.id ? { ...item, status: result.data! } : item)),
    );
  }

  async function saveMate(request: JoinRequest) {
    setDecidingId(request.id);
    setError('');
    const result = await saveCatchMate(request.requesterId);
    setDecidingId('');
    if (result.error) {
      setError(result.error);
      return;
    }
    setSavedMateIds((current) => [...current, request.requesterId]);
  }

  const pending = requests.filter((request) => request.status === 'requested');
  const decided = requests.filter((request) => request.status !== 'requested');

  return (
    <Screen>
      <Text style={styles.eyebrow}>HOST APPROVALS</Text>
      <Text style={styles.title}>Join requests</Text>
      <Text style={styles.subtitle}>
        {catchItem?.title ?? 'Review who wants to join your Catch.'}
      </Text>
      {catchItem?.locationType === 'private' ? (
        <View style={styles.privacy}>
          <Ionicons color={colors.forest} name="lock-closed" size={19} />
          <Text style={styles.privacyText}>
            Approving someone unlocks this Catch&apos;s exact private location for that person.
          </Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.orange} />
          <Text style={styles.muted}>Loading requests...</Text>
        </View>
      ) : null}
      {!isLoading && pending.length === 0 ? (
        <StatePanel
          body="New requests will appear here. No exact private location is revealed until you approve."
          icon="people-outline"
          title="No pending requests"
        />
      ) : null}
      {pending.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Waiting on you</Text>
          {pending.map((request) => (
            <RequestCard
              busy={decidingId === request.id}
              key={request.id}
              onApprove={() => decide(request, true)}
              onDecline={() => decide(request, false)}
              request={request}
            />
          ))}
        </View>
      ) : null}
      {decided.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Already decided</Text>
          {decided.map((request) => (
            <RequestCard
              busy={decidingId === request.id}
              key={request.id}
              onSave={
                request.status === 'approved' && !savedMateIds.includes(request.requesterId)
                  ? () => saveMate(request)
                  : undefined
              }
              onProfile={
                request.status === 'approved'
                  ? () =>
                      router.push({
                        pathname: '/member/[id]',
                        params: { id: request.requesterId },
                      })
                  : undefined
              }
              request={request}
              saved={savedMateIds.includes(request.requesterId)}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function RequestCard({
  busy = false,
  onApprove,
  onDecline,
  onProfile,
  onSave,
  request,
  saved = false,
}: {
  busy?: boolean;
  onApprove?: () => void;
  onDecline?: () => void;
  onProfile?: () => void;
  onSave?: () => void;
  request: JoinRequest;
  saved?: boolean;
}) {
  const initials = memberInitials(request.requesterFirstName);
  return (
    <View style={styles.card}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{initials || '?'}</Text></View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.name}>{request.requesterFirstName}</Text>
          <Text style={styles.status}>{request.status.toUpperCase()}</Text>
        </View>
        <Text style={styles.muted}>{request.message || 'No message included.'}</Text>
        {onProfile ? (
          <Pressable
            accessibilityLabel={`View ${request.requesterFirstName}'s participant profile`}
            onPress={onProfile}
            style={({ pressed }) => [styles.profileLink, pressed && styles.pressed]}>
            <Ionicons color={colors.forest} name="person-circle-outline" size={17} />
            <Text style={styles.profileLinkText}>View participant profile</Text>
          </Pressable>
        ) : null}
        {onApprove && onDecline ? (
          <View style={styles.actions}>
            <Pressable
              disabled={busy}
              onPress={onDecline}
              style={({ pressed }) => [styles.decline, pressed && styles.pressed]}>
              <Text style={styles.declineText}>Decline</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={onApprove}
              style={({ pressed }) => [styles.approve, pressed && styles.pressed]}>
              <Ionicons color={colors.white} name="checkmark" size={17} />
              <Text style={styles.approveText}>{busy ? 'Saving...' : 'Approve'}</Text>
            </Pressable>
          </View>
        ) : null}
        {onSave || saved ? (
          <Pressable
            disabled={busy || saved}
            onPress={onSave}
            style={({ pressed }) => [styles.saveMate, pressed && styles.pressed]}>
            <Ionicons
              color={colors.forest}
              name={saved ? 'checkmark-circle' : 'person-add-outline'}
              size={16}
            />
            <Text style={styles.saveMateText}>
              {saved ? 'Saved as Catch Mate' : busy ? 'Saving...' : 'Save as Catch Mate'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: { marginTop: spacing.sm, color: colors.orangeDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 31, fontWeight: '900' },
  subtitle: { marginTop: 3, color: colors.muted, fontSize: 13 },
  privacy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.paleGreen,
    padding: 13,
  },
  privacyText: { flex: 1, color: colors.forest, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  loading: { alignItems: 'center', gap: 9, marginTop: spacing.xl },
  section: { gap: 11, marginTop: spacing.xl },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
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
  avatar: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.paleOrange,
  },
  avatarText: { color: colors.forest, fontSize: 14, fontWeight: '900' },
  cardBody: { flex: 1, gap: 7 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  status: { color: colors.forest, fontSize: 8, fontWeight: '900' },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 4 },
  profileLink: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  profileLinkText: { color: colors.forest, fontSize: 11, fontWeight: '800' },
  decline: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 42 },
  declineText: { color: colors.error, fontSize: 12, fontWeight: '800' },
  approve: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 42,
    borderRadius: 13,
    backgroundColor: colors.forest,
  },
  approveText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  saveMate: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 39,
    borderRadius: 12,
    backgroundColor: colors.paleGreen,
  },
  saveMateText: { color: colors.forest, fontSize: 11, fontWeight: '800' },
  error: { marginTop: spacing.md, color: colors.error, fontSize: 13, textAlign: 'center' },
  pressed: { opacity: 0.76 },
});
