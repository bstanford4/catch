import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { catchLocationLabel } from '@/components/hosted-catch-card';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { StatePanel } from '@/components/ui/state-panel';
import { colors, radius, spacing } from '@/constants/theme';
import { getActivity, getCatch } from '@/data/demo';
import { useAuth } from '@/providers/auth-provider';
import { saveCatchMate } from '@/services/catch-mate-service';
import {
  type HostedCatch,
  type JoinRequest,
  type PrivateCatchLocation,
  getCatchDetails,
  getMyJoinRequest,
  getPrivateCatchLocation,
  requestToJoin,
  withdrawJoinRequest,
} from '@/services/catch-service';
import {
  type CatchParticipant,
  listCatchParticipants,
} from '@/services/participant-profile-service';

export default function CatchDetailsScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const demoItem = getCatch(id);
  if (demoItem) return <DemoCatchDetails id={id} />;
  return <LiveCatchDetails id={id} />;
}

function LiveCatchDetails({ id }: { id: string }) {
  const router = useRouter();
  const { session } = useAuth();
  const [item, setItem] = useState<HostedCatch | null>(null);
  const [request, setRequest] = useState<JoinRequest | null>(null);
  const [privateLocation, setPrivateLocation] = useState<PrivateCatchLocation | null>(null);
  const [participants, setParticipants] = useState<CatchParticipant[]>([]);
  const [message, setMessage] = useState('');
  const [mateSaved, setMateSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      if (!session) {
        setIsLoading(false);
        return;
      }
      const [catchResult, requestResult] = await Promise.all([
        getCatchDetails(id),
        getMyJoinRequest(id, session.user.id),
      ]);
      if (!active) return;
      setItem(catchResult.data);
      setRequest(requestResult.data);
      setError(catchResult.error ?? requestResult.error ?? '');
      const maySeePrivate =
        catchResult.data?.hostId === session.user.id || requestResult.data?.status === 'approved';
      if (maySeePrivate) {
        const participantResult = await listCatchParticipants(id);
        if (!active) return;
        setParticipants(participantResult.data);
        if (participantResult.error) setError(participantResult.error);
      }
      if (maySeePrivate && catchResult.data?.locationType === 'private') {
        const locationResult = await getPrivateCatchLocation(id);
        if (!active) return;
        setPrivateLocation(locationResult.data);
        if (locationResult.error) setError(locationResult.error);
      }
      setIsLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [id, session]);

  async function sendRequest() {
    setIsSaving(true);
    setError('');
    const result = await requestToJoin(id, message);
    setIsSaving(false);
    if (result.error || !result.data) {
      setError(result.error ?? 'Request could not be sent.');
      return;
    }
    const refreshed = session ? await getMyJoinRequest(id, session.user.id) : null;
    setRequest(
      refreshed?.data ?? {
        createdAt: new Date().toISOString(),
        id: result.data,
        message: message.trim() || null,
        requesterFirstName: '',
        requesterId: session?.user.id ?? '',
        status: 'requested',
      },
    );
    if (refreshed?.data?.status === 'approved' && item?.locationType === 'private') {
      const locationResult = await getPrivateCatchLocation(id);
      setPrivateLocation(locationResult.data);
    }
    if (refreshed?.data?.status === 'approved') {
      const participantResult = await listCatchParticipants(id);
      setParticipants(participantResult.data);
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function withdraw() {
    if (!request) return;
    setIsSaving(true);
    const result = await withdrawJoinRequest(request.id);
    setIsSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setRequest({ ...request, status: 'withdrawn' });
  }

  async function saveHost() {
    setIsSaving(true);
    setError('');
    const result = await saveCatchMate(item?.hostId ?? '');
    setIsSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMateSaved(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  if (isLoading) {
    return (
      <Screen contentContainerStyle={styles.loading}>
        <ActivityIndicator color={colors.orange} size="large" />
        <Text style={styles.muted}>Loading Catch details...</Text>
      </Screen>
    );
  }
  if (!session) {
    return (
      <Screen>
        <StatePanel
          body="Sign in to view live Catch details and request to join."
          icon="person-outline"
          title="Sign in first"
        />
      </Screen>
    );
  }
  if (!item) {
    return (
      <Screen>
        <StatePanel
          body={error || 'This Catch may have expired, filled up, or been canceled.'}
          icon="calendar-outline"
          title="That one got away"
        />
      </Screen>
    );
  }

  const start = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(item.startsAt));
  const isHost = item.hostId === session.user.id;
  const approved = request?.status === 'approved';
  const locationValue = privateLocation
    ? `${privateLocation.placeName} · ${privateLocation.exactAddress}`
    : catchLocationLabel(item);

  return (
    <Screen>
      <LinearGradient colors={[item.activity.color, colors.paper]} style={styles.hero}>
        <View style={styles.icon}><Text style={styles.emoji}>{item.activity.emoji}</Text></View>
        <Text style={styles.kindText}>
          {item.kind === 'now' ? 'CATCH NOW' : (item.customActivityName ?? item.activity.name).toUpperCase()}
        </Text>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtype}>{item.intensity}</Text>
      </LinearGradient>

      <Pressable
        accessibilityLabel={
          approved && !isHost ? `View ${item.hostFirstName}'s participant profile` : undefined
        }
        disabled={!approved || isHost}
        onPress={() =>
          router.push({
            pathname: '/member/[id]',
            params: { id: item.hostId },
          })
        }
        style={({ pressed }) => [styles.hostRow, pressed && styles.pressed]}>
        <Avatar initials={item.hostFirstName.slice(0, 2).toUpperCase()} size={52} tone="gold" />
        <View style={styles.hostText}>
          <Text style={styles.hostName}>{item.hostFirstName} is hosting</Text>
          <Text style={styles.muted}>
            {approved && !isHost
              ? 'Tap to view participant profile.'
              : 'Approval protects private meeting details.'}
          </Text>
        </View>
        {approved && !isHost ? (
          <Ionicons color={colors.muted} name="chevron-forward" size={20} />
        ) : null}
      </Pressable>

      <View style={styles.detailCard}>
        <Detail icon="time-outline" label="When" value={`${start} · ${item.durationMinutes} min`} />
        <Detail
          icon={privateLocation ? 'navigate-outline' : 'location-outline'}
          label={privateLocation ? 'Approved meeting spot' : 'Where'}
          value={locationValue}
        />
        <Detail icon="people-outline" label="Crew" value={`Up to ${item.capacity} people`} />
        <Detail icon="speedometer-outline" label="Vibe" value={item.intensity} />
      </View>

      {privateLocation?.arrivalNotes ? (
        <View style={styles.about}>
          <Text style={styles.sectionTitle}>Arrival notes</Text>
          <Text style={styles.description}>{privateLocation.arrivalNotes}</Text>
        </View>
      ) : null}
      <View style={styles.about}>
        <Text style={styles.sectionTitle}>The plan</Text>
        <Text style={styles.description}>{item.description || 'A casual Catch with the details above.'}</Text>
      </View>

      {(isHost || approved) && participants.filter((person) => person.role !== 'host').length ? (
        <View style={styles.about}>
          <Text style={styles.sectionTitle}>Catch crew</Text>
          <Text style={styles.crewHelper}>Approved participants only.</Text>
          <View style={styles.crewList}>
            {participants
              .filter((person) => person.role !== 'host')
              .map((person) => (
                <Pressable
                  accessibilityLabel={`View ${person.firstName}'s participant profile`}
                  key={person.userId}
                  onPress={() =>
                    router.push({
                      pathname: '/member/[id]',
                      params: { id: person.userId },
                    })
                  }
                  style={({ pressed }) => [styles.crewRow, pressed && styles.pressed]}>
                  <Avatar
                    initials={person.firstName.slice(0, 2).toUpperCase()}
                    size={42}
                    tone="green"
                  />
                  <View style={styles.crewBody}>
                    <Text style={styles.crewName}>{person.firstName}</Text>
                    <Text style={styles.muted}>
                      {person.isCatchMate ? 'Catch Mate' : 'Approved participant'}
                    </Text>
                  </View>
                  <Ionicons color={colors.muted} name="chevron-forward" size={19} />
                </Pressable>
              ))}
          </View>
        </View>
      ) : null}

      <View style={styles.privacy}>
        <Ionicons color={colors.forest} name="shield-checkmark" size={21} />
        <View style={styles.privacyText}>
          <Text style={styles.privacyTitle}>
            {item.locationType === 'private'
              ? privateLocation
                ? 'Private location unlocked'
                : 'Private location protected'
              : item.locationType === 'later'
                ? 'Exact spot decided later'
                : 'Public meeting place'}
          </Text>
          <Text style={styles.privacyBody}>
            {item.locationType === 'private' && !privateLocation
              ? `Only the broad area is visible. ${item.hostFirstName} must approve you before the exact address appears.`
              : item.locationType === 'private'
                ? 'You can see this because you are the host or an approved participant. Do not share it.'
                : 'Use good judgment and coordinate any last details with the crew.'}
          </Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!isHost && (!request || ['declined', 'withdrawn'].includes(request.status)) ? (
        <View style={styles.requestBox}>
          <Text style={styles.sectionTitle}>Ask to join</Text>
          <TextInput
            accessibilityLabel="Optional message to the host"
            maxLength={500}
            multiline
            onChangeText={setMessage}
            placeholder="Optional: introduce yourself or mention what you can bring"
            placeholderTextColor={colors.muted}
            style={styles.messageInput}
            value={message}
          />
          <Button
            disabled={isSaving || item.status !== 'open'}
            icon="hand-left"
            label={isSaving ? 'Sending...' : 'Request to join'}
            onPress={sendRequest}
          />
        </View>
      ) : null}
      {!isHost && request?.status === 'requested' ? (
        <View style={styles.requestBox}>
          <Text style={styles.requestStatus}>Request pending</Text>
          <Text style={styles.muted}>{item.hostFirstName} can approve or decline it.</Text>
          <Button
            disabled={isSaving}
            label={isSaving ? 'Withdrawing...' : 'Withdraw request'}
            onPress={withdraw}
            variant="secondary"
          />
        </View>
      ) : null}
      {!isHost && approved ? (
        <View style={styles.requestBox}>
          <Text style={styles.approved}>You are approved for this Catch.</Text>
          <Button
            disabled={isSaving || mateSaved}
            icon={mateSaved ? 'checkmark-circle' : 'person-add-outline'}
            label={mateSaved ? `${item.hostFirstName} is a Catch Mate` : `Save ${item.hostFirstName} as a Catch Mate`}
            onPress={saveHost}
            variant="secondary"
          />
        </View>
      ) : null}
      {isHost ? (
        <Text style={styles.approved}>You are hosting this Catch. Manage requests from My Catches.</Text>
      ) : null}
      {isHost || approved ? (
        <View style={styles.requestBox}>
          <Button
            icon="chatbubble-ellipses-outline"
            label="Open Catch chat"
            onPress={() =>
              router.push({
                pathname: '/message/[type]/[id]',
                params: { id, type: 'catch' },
              })
            }
            variant="secondary"
          />
        </View>
      ) : null}
      <Text style={styles.footerNote}>You can leave, block, or report at any time.</Text>
    </Screen>
  );
}

function DemoCatchDetails({ id }: { id: string }) {
  const item = getCatch(id);
  const [requested, setRequested] = useState(false);
  if (!item) return null;
  const activity = getActivity(item.activityId);
  const spots = item.capacity - item.participants;
  return (
    <Screen>
      <LinearGradient colors={[activity.color, colors.paper]} style={styles.hero}>
        <View style={styles.icon}><Text style={styles.emoji}>{activity.emoji}</Text></View>
        <Text style={styles.kindText}>{item.kind === 'now' ? 'CATCH NOW' : activity.name.toUpperCase()}</Text>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtype}>{item.subtype}</Text>
      </LinearGradient>
      <View style={styles.hostRow}>
        <Avatar initials={item.hostInitials} size={52} tone="gold" />
        <Text style={styles.hostName}>{item.host} is hosting</Text>
      </View>
      <View style={styles.detailCard}>
        <Detail icon="time-outline" label="When" value={item.timeLabel} />
        <Detail icon="location-outline" label="Where" value={item.venue} />
        <Detail icon="people-outline" label="Crew" value={`${item.participants} going · ${spots} spots left`} />
        <Detail icon="speedometer-outline" label="Vibe" value={item.intensity} />
      </View>
      <View style={styles.about}>
        <Text style={styles.sectionTitle}>The plan</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>
      <View style={styles.privacy}>
        <Ionicons color={colors.forest} name="shield-checkmark" size={21} />
        <Text style={styles.privacyBody}>
          {item.isPublicVenue ? 'This demo uses a public venue.' : 'Exact details appear only after host approval.'}
        </Text>
      </View>
      <Button
        disabled={requested}
        icon={requested ? 'checkmark-circle' : 'hand-left'}
        label={requested ? 'Demo request sent' : 'Request to join'}
        onPress={() => {
          setRequested(true);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Demo request sent', 'Live requests are used when signed in with Supabase.');
        }}
      />
    </Screen>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}><Ionicons color={colors.forest} name={icon} size={19} /></View>
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  hero: { alignItems: 'center', marginTop: spacing.sm, borderRadius: 25, padding: 23 },
  icon: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  emoji: { fontSize: 34 },
  kindText: { marginTop: 14, color: colors.orangeDark, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  title: { marginTop: 9, color: colors.ink, fontSize: 27, fontWeight: '900', textAlign: 'center' },
  subtype: { marginTop: 3, color: colors.muted, fontSize: 13 },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: spacing.lg },
  hostText: { flex: 1, gap: 3 },
  hostName: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  pressed: { opacity: 0.75 },
  detailCard: {
    gap: 15,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    padding: spacing.md,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.paleGreen,
  },
  detailText: { flex: 1, gap: 2 },
  detailLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  detailValue: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  about: { marginTop: spacing.lg, gap: 6 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  crewHelper: { color: colors.muted, fontSize: 10 },
  crewList: { gap: 8, marginTop: 5 },
  crewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    padding: 10,
  },
  crewBody: { flex: 1 },
  crewName: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  privacy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.paleGreen,
    padding: 14,
  },
  privacyText: { flex: 1, gap: 2 },
  privacyTitle: { color: colors.forest, fontSize: 13, fontWeight: '800' },
  privacyBody: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 16 },
  requestBox: { gap: 11, marginBottom: spacing.md },
  messageInput: {
    minHeight: 92,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    color: colors.ink,
    padding: 13,
    textAlignVertical: 'top',
  },
  requestStatus: { color: colors.orangeDark, fontSize: 16, fontWeight: '900' },
  approved: {
    marginBottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.paleGreen,
    color: colors.forest,
    fontSize: 13,
    fontWeight: '800',
    padding: 13,
    textAlign: 'center',
  },
  error: { marginBottom: 12, color: colors.error, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  footerNote: { color: colors.muted, fontSize: 11, textAlign: 'center' },
});
