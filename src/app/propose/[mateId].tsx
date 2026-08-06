import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Screen } from '@/components/ui/screen';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { createDirectCatchProposal } from '@/services/catch-mate-service';
import {
  type CatchCatalogActivity,
  type CatchVenue,
  loadCatchCatalog,
} from '@/services/catch-service';

const durationOptions = [30, 45, 60, 90];

function dateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function timeInputValue(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function parseLocalDateTime(dateValue: string, timeValue: string) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(timeValue.trim());
  if (!dateMatch || !timeMatch) return null;
  const parsed = new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function ProposeCatchScreen() {
  const { activity, mateId = '', name = 'your Catch Mate' } = useLocalSearchParams<{
    activity?: string;
    mateId: string;
    name?: string;
  }>();
  const router = useRouter();
  const { profile, session } = useAuth();
  const [baseNow] = useState(() => new Date());
  const [initialStart] = useState(() => {
    const date = new Date(baseNow.getTime() + 24 * 60 * 60_000);
    date.setMinutes(0, 0, 0);
    return date;
  });
  const [activities, setActivities] = useState<CatchCatalogActivity[]>([]);
  const [venues, setVenues] = useState<CatchVenue[]>([]);
  const [activityId, setActivityId] = useState('');
  const [locationType, setLocationType] = useState<'later' | 'catalog' | 'private'>('later');
  const [venueId, setVenueId] = useState<string | null>(null);
  const [areaLabel, setAreaLabel] = useState(profile?.areaLabel ?? '');
  const [privatePlaceName, setPrivatePlaceName] = useState('');
  const [privateAddress, setPrivateAddress] = useState('');
  const [privateArrivalNotes, setPrivateArrivalNotes] = useState('');
  const [privateConfirmed, setPrivateConfirmed] = useState(false);
  const [dateValue, setDateValue] = useState(dateInputValue(initialStart));
  const [timeValue, setTimeValue] = useState(timeInputValue(initialStart));
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void loadCatchCatalog().then((result) => {
      if (!active) return;
      setActivities(result.activities);
      setVenues(result.venues);
      setActivityId(
        result.activities.find((item) => item.id === activity || item.slug === activity)?.id ??
          result.activities[0]?.id ??
          '',
      );
      setError(result.error ?? '');
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [activity]);

  const selectedVenue = venues.find((venue) => venue.id === venueId) ?? null;
  const startsAt = parseLocalDateTime(dateValue, timeValue);

  async function submit() {
    if (!session) {
      setError('Sign in before sending a proposal.');
      return;
    }
    if (!activityId) {
      setError('Choose an activity.');
      return;
    }
    if (!startsAt || startsAt.getTime() <= baseNow.getTime()) {
      setError('Enter a valid future date and time.');
      return;
    }
    if (!areaLabel.trim()) {
      setError('Enter a broad meeting area.');
      return;
    }
    if (locationType === 'private') {
      if (!privatePlaceName.trim()) {
        setError('Enter a name for the private meeting place.');
        return;
      }
      if (privateAddress.trim().length < 3) {
        setError('Enter the exact address or precise meeting instructions.');
        return;
      }
      if (!privateConfirmed) {
        setError('Confirm that the exact location may be shared after the proposal is accepted.');
        return;
      }
    }
    setIsSaving(true);
    setError('');
    const result = await createDirectCatchProposal({
      activityTypeId: activityId,
      areaLabel,
      durationMinutes,
      locationType,
      message,
      privateLocation:
        locationType === 'private'
          ? {
              arrivalNotes: privateArrivalNotes.trim() || null,
              exactAddress: privateAddress,
              latitude: null,
              longitude: null,
              placeName: privatePlaceName,
            }
          : null,
      recipientId: mateId,
      startsAt: startsAt.toISOString(),
      venueId,
    });
    setIsSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/proposals');
  }

  return (
    <Screen>
      <Text style={styles.eyebrow}>DIRECT PROPOSAL</Text>
      <Text style={styles.title}>Ask {name} to catch.</Text>
      <Text style={styles.subtitle}>
        Send a simple plan. If {name} accepts, Catch creates a private two-person plan.
      </Text>

      <Text style={styles.label}>Activity</Text>
      <View style={styles.activityGrid}>
        {activities.map((activity) => {
          const selected = activity.id === activityId;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={activity.id}
              onPress={() => setActivityId(activity.id)}
              style={[styles.activity, selected && styles.activitySelected]}>
              <Text style={styles.emoji}>{activity.emoji}</Text>
              <Text style={[styles.activityName, selected && styles.activityNameSelected]}>
                {activity.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>When</Text>
      <View style={styles.fieldRow}>
        <View style={styles.field}>
          <Text style={styles.smallLabel}>Date</Text>
          <TextInput
            accessibilityLabel="Proposal date"
            onChangeText={setDateValue}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={dateValue}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.smallLabel}>Time</Text>
          <TextInput
            accessibilityLabel="Proposal time"
            onChangeText={setTimeValue}
            placeholder="18:00"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={timeValue}
          />
        </View>
      </View>

      <Text style={styles.label}>Duration</Text>
      <View style={styles.chips}>
        {durationOptions.map((duration) => (
          <Chip
            key={duration}
            label={`${duration} min`}
            onPress={() => setDurationMinutes(duration)}
            selected={durationMinutes === duration}
          />
        ))}
      </View>

      <Text style={styles.label}>Where</Text>
      <View style={styles.venueList}>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: locationType === 'later' }}
          onPress={() => {
            setLocationType('later');
            setVenueId(null);
          }}
          style={[styles.venue, locationType === 'later' && styles.venueSelected]}>
          <View style={[styles.radio, locationType === 'later' && styles.radioSelected]}>
            {locationType === 'later' ? <View style={styles.radioDot} /> : null}
          </View>
          <View style={styles.venueText}>
            <Text style={styles.venueName}>Decide together later</Text>
            <Text style={styles.venueArea}>Start with a broad area</Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: locationType === 'private' }}
          onPress={() => {
            setLocationType('private');
            setVenueId(null);
          }}
          style={[styles.venue, locationType === 'private' && styles.venueSelected]}>
          <View style={[styles.radio, locationType === 'private' && styles.radioSelected]}>
            {locationType === 'private' ? <View style={styles.radioDot} /> : null}
          </View>
          <View style={styles.venueText}>
            <Text style={styles.venueName}>Private / informal location</Text>
            <Text style={styles.venueArea}>Exact details unlock only after acceptance</Text>
          </View>
          <Ionicons color={colors.forest} name="lock-closed-outline" size={19} />
        </Pressable>
        {venues.map((venue) => {
          const selected = locationType === 'catalog' && venue.id === venueId;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={venue.id}
              onPress={() => {
                setLocationType('catalog');
                setVenueId(venue.id);
                setAreaLabel(venue.areaLabel);
              }}
              style={[styles.venue, selected && styles.venueSelected]}>
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
              <View style={styles.venueText}>
                <Text style={styles.venueName}>{venue.name}</Text>
                <Text style={styles.venueArea}>{venue.areaLabel}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.smallLabel}>Broad meeting area</Text>
      <TextInput
        accessibilityLabel="Proposal broad meeting area"
        maxLength={100}
        onChangeText={setAreaLabel}
        placeholder="e.g. North Stafford"
        placeholderTextColor={colors.muted}
        style={styles.input}
        value={areaLabel}
      />
      {locationType === 'private' ? (
        <View style={styles.privateFields}>
          <View style={styles.privateNotice}>
            <Ionicons color={colors.forest} name="shield-checkmark" size={20} />
            <Text style={styles.privateNoticeText}>
              {name} sees only the broad area before accepting. The exact location is encrypted
              and unlocks inside the accepted Catch.
            </Text>
          </View>
          <Text style={styles.smallLabel}>Private place name</Text>
          <TextInput
            accessibilityLabel="Proposal private place name"
            maxLength={100}
            onChangeText={setPrivatePlaceName}
            placeholder="e.g. Blake's driveway hoop"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={privatePlaceName}
          />
          <Text style={styles.smallLabel}>Exact address or meeting instructions</Text>
          <TextInput
            accessibilityLabel="Proposal private exact address"
            maxLength={300}
            onChangeText={setPrivateAddress}
            placeholder="Street address or precise meeting point"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={privateAddress}
          />
          <Text style={styles.smallLabel}>Arrival notes (optional)</Text>
          <TextInput
            accessibilityLabel="Proposal private arrival notes"
            maxLength={500}
            multiline
            onChangeText={setPrivateArrivalNotes}
            placeholder="e.g. Use the side gate"
            placeholderTextColor={colors.muted}
            style={styles.privateNotes}
            value={privateArrivalNotes}
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: privateConfirmed }}
            onPress={() => setPrivateConfirmed((current) => !current)}
            style={styles.confirmRow}>
            <Ionicons
              color={colors.forest}
              name={privateConfirmed ? 'checkbox' : 'square-outline'}
              size={24}
            />
            <Text style={styles.confirmText}>
              Share these exact details with {name} only after acceptance.
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.label}>Message (optional)</Text>
      <TextInput
        accessibilityLabel="Proposal message"
        maxLength={500}
        multiline
        onChangeText={setMessage}
        placeholder="Want to get a few throws in?"
        placeholderTextColor={colors.muted}
        style={styles.message}
        value={message}
      />

      <View style={styles.preview}>
        <Ionicons color={colors.forest} name="paper-plane-outline" size={21} />
        <Text style={styles.previewText}>
          {startsAt
            ? `${new Intl.DateTimeFormat('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              }).format(startsAt)} · ${durationMinutes} min · ${
                selectedVenue?.name ??
                (locationType === 'private'
                  ? `${areaLabel || 'broad area'} · private spot unlocks after acceptance`
                  : `${areaLabel || 'broad area'}, exact spot later`)
              }`
            : 'Enter a valid date and time'}
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        disabled={isLoading || isSaving}
        icon="paper-plane"
        label={isLoading ? 'Loading...' : isSaving ? 'Sending...' : `Send to ${name}`}
        onPress={submit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { marginTop: spacing.sm, color: colors.orangeDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { maxWidth: 450, color: colors.ink, fontSize: 31, fontWeight: '900' },
  subtitle: { maxWidth: 500, marginTop: 5, color: colors.muted, fontSize: 13, lineHeight: 20 },
  label: { marginTop: spacing.lg, marginBottom: 8, color: colors.ink, fontSize: 13, fontWeight: '800' },
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  activity: {
    minWidth: 102,
    flexGrow: 1,
    minHeight: 66,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    padding: 8,
  },
  activitySelected: { borderColor: colors.forest, backgroundColor: colors.paleGreen },
  emoji: { fontSize: 22 },
  activityName: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  activityNameSelected: { color: colors.forest, fontWeight: '800' },
  fieldRow: { flexDirection: 'row', gap: 10 },
  field: { flex: 1, gap: 6 },
  smallLabel: { marginTop: 8, marginBottom: 5, color: colors.muted, fontSize: 10, fontWeight: '700' },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    color: colors.ink,
    fontSize: 14,
    paddingHorizontal: 13,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  venueList: { gap: 8 },
  venue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    padding: 12,
  },
  venueSelected: { borderColor: colors.grass, backgroundColor: colors.paleGreen },
  radio: {
    width: 21,
    height: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    backgroundColor: colors.white,
  },
  radioSelected: { borderColor: colors.forest },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.forest },
  venueText: { flex: 1, gap: 2 },
  venueName: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  venueArea: { color: colors.muted, fontSize: 10 },
  privateFields: { gap: 2, marginTop: 8 },
  privateNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginBottom: 6,
    borderRadius: radius.md,
    backgroundColor: colors.paleGreen,
    padding: 12,
  },
  privateNoticeText: { flex: 1, color: colors.forest, fontSize: 11, lineHeight: 17 },
  privateNotes: {
    minHeight: 78,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    padding: 13,
    textAlignVertical: 'top',
  },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 48 },
  confirmText: { flex: 1, color: colors.ink, fontSize: 11, lineHeight: 16 },
  message: {
    minHeight: 95,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    padding: 13,
    textAlignVertical: 'top',
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.paleGreen,
    padding: 13,
  },
  previewText: { flex: 1, color: colors.forest, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  error: { marginBottom: 12, color: colors.error, fontSize: 13, textAlign: 'center' },
});
