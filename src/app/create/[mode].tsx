import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Screen } from '@/components/ui/screen';
import { colors, radius, spacing } from '@/constants/theme';
import { activities as demoActivities } from '@/data/demo';
import { useAuth } from '@/providers/auth-provider';
import {
  type CatchCatalogActivity,
  type CatchInput,
  type CatchVenue,
  createCatch,
  getHostedCatch,
  loadCatchCatalog,
  updateCatch,
} from '@/services/catch-service';

const copy = {
  now: {
    eyebrow: 'CATCH NOW',
    title: 'What are you up for?',
    subtitle: 'Tell nearby people what sounds good in the next few hours.',
    submit: 'Post Catch Now',
  },
  scheduled: {
    eyebrow: 'POST A CATCH',
    title: 'Put a good plan on the board.',
    subtitle: 'Pick the basics now. Fine-tune the details with your catch crew.',
    submit: 'Post this Catch',
  },
} as const;

const durations = [30, 45, 60, 90];
const nowOffsets = [30, 60, 90, 120];
const scheduledHours = [
  { hour: 9, label: '9 AM' },
  { hour: 12, label: 'Noon' },
  { hour: 15, label: '3 PM' },
  { hour: 18, label: '6 PM' },
  { hour: 20, label: '8 PM' },
];
const vibes = ['Easygoing', 'Beginner-friendly', 'Bring the heat'];

const demoCatalog: CatchCatalogActivity[] = demoActivities.map((activity) => ({
  color: activity.color,
  emoji: activity.emoji,
  id: activity.id,
  name: activity.name,
  slug: activity.id,
}));
const demoVenues: CatchVenue[] = [
  {
    addressDisplay: 'North Stafford public park',
    areaLabel: 'North Stafford',
    id: 'demo-embrey',
    name: 'Embrey Mill Park',
  },
  {
    addressDisplay: 'Stafford public recreation area',
    areaLabel: 'Stafford',
    id: 'demo-smith',
    name: 'Smith Lake Field',
  },
  {
    addressDisplay: 'Garrisonville public courts',
    areaLabel: 'Garrisonville',
    id: 'demo-willowmere',
    name: 'Willowmere Courts',
  },
];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export default function CreateModeScreen() {
  const params = useLocalSearchParams<{ activity?: string; catchId?: string; mode?: string }>();
  const router = useRouter();
  const { profile, session } = useAuth();
  const mode = params.mode === 'now' ? 'now' : params.mode === 'open' ? 'open' : 'scheduled';
  const editingId = params.catchId;
  const initialActivity =
    demoActivities.find((activity) => activity.id === params.activity) ?? demoActivities[0];
  const [catalog, setCatalog] = useState<CatchCatalogActivity[]>(demoCatalog);
  const [venues, setVenues] = useState<CatchVenue[]>(demoVenues);
  const [activitySlug, setActivitySlug] = useState(initialActivity.id);
  const [venueId, setVenueId] = useState(demoVenues[0].id);
  const [title, setTitle] = useState(`${initialActivity.name} catch`);
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [nowOffsetMinutes, setNowOffsetMinutes] = useState(60);
  const [scheduledDay, setScheduledDay] = useState(1);
  const [scheduledHour, setScheduledHour] = useState(18);
  const [capacity, setCapacity] = useState(4);
  const [intensity, setIntensity] = useState('Easygoing');
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [minimumAge, setMinimumAge] = useState<18 | 21>(18);
  const [note, setNote] = useState('');
  const [baseNow] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const dayOptions = useMemo(
    () =>
      Array.from({ length: 14 }, (_, offset) => {
        const date = new Date(baseNow);
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + offset);
        const label =
          offset === 0
            ? 'Today'
            : offset === 1
              ? 'Tomorrow'
              : new Intl.DateTimeFormat('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                }).format(date);
        return { date, label, offset };
      }),
    [baseNow],
  );

  useEffect(() => {
    if (!session) return;
    let active = true;
    void Promise.all([
      loadCatchCatalog(),
      editingId
        ? getHostedCatch(editingId, session.user.id)
        : Promise.resolve({ data: null, error: null }),
    ]).then(([catalogResult, catchResult]) => {
      if (!active) return;
      if (catalogResult.error) {
        setError(catalogResult.error);
      } else {
        const preferredSlugs = profile?.activitySlugs ?? [];
        const sorted = [...catalogResult.activities].sort((a, b) => {
          const aPreferred = preferredSlugs.includes(a.slug) ? 0 : 1;
          const bPreferred = preferredSlugs.includes(b.slug) ? 0 : 1;
          return aPreferred - bPreferred;
        });
        setCatalog(sorted);
        setVenues(catalogResult.venues);
        if (!editingId) {
          const requested = sorted.find((activity) => activity.slug === params.activity);
          const chosen = requested ?? sorted[0];
          setActivitySlug(chosen?.slug ?? 'baseball');
          setVenueId(catalogResult.venues[0]?.id ?? '');
          if (chosen) setTitle(`${chosen.name} catch`);
        }
      }

      if (catchResult.error) {
        setError(catchResult.error);
      } else if (editingId && !catchResult.data) {
        setError('That Catch could not be found or is no longer editable.');
      } else if (catchResult.data) {
        const item = catchResult.data;
        setActivitySlug(item.activity.slug);
        setVenueId(item.venue?.id ?? '');
        setTitle(item.title);
        setDurationMinutes(item.durationMinutes);
        setCapacity(item.capacity);
        setIntensity(item.intensity);
        setApprovalRequired(item.approvalRequired);
        setMinimumAge(item.minimumAge);
        setNote(item.description);
        const start = new Date(item.startsAt);
        if (item.kind === 'now') {
          const minutes = Math.max(30, Math.round((start.getTime() - Date.now()) / 60_000));
          setNowOffsetMinutes(
            nowOffsets.reduce((closest, option) =>
              Math.abs(option - minutes) < Math.abs(closest - minutes) ? option : closest,
            ),
          );
        } else {
          const day = dayOptions.find((option) => dateKey(option.date) === dateKey(start));
          setScheduledDay(day?.offset ?? 1);
          const hour = scheduledHours.reduce((closest, option) =>
            Math.abs(option.hour - start.getHours()) <
            Math.abs(closest.hour - start.getHours())
              ? option
              : closest,
          );
          setScheduledHour(hour.hour);
        }
      }
      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [dayOptions, editingId, params.activity, profile?.activitySlugs, session]);

  const selectedActivity =
    catalog.find((activity) => activity.slug === activitySlug) ?? catalog[0];
  const selectedVenue = venues.find((venue) => venue.id === venueId) ?? venues[0];
  const startsAt = useMemo(() => {
    if (mode === 'now') {
      const date = new Date(baseNow.getTime() + nowOffsetMinutes * 60_000);
      date.setSeconds(0, 0);
      return date;
    }
    const date = new Date(dayOptions[scheduledDay]?.date ?? dayOptions[1].date);
    date.setHours(scheduledHour, 0, 0, 0);
    return date;
  }, [baseNow, dayOptions, mode, nowOffsetMinutes, scheduledDay, scheduledHour]);

  if (mode === 'open') {
    return (
      <Screen>
        <Text style={styles.eyebrow}>OPEN TO CATCH</Text>
        <Text style={styles.title}>Let a good plan find you.</Text>
        <Text style={styles.subtitle}>
          Your broad availability is ready now. Publishing it to nearby people is the next
          proposal-and-discovery slice.
        </Text>
        <View style={styles.openCard}>
          <Ionicons color={colors.forest} name="time-outline" size={28} />
          <Text style={styles.openTitle}>Set your usual availability</Text>
          <Text style={styles.openBody}>
            Choose broad days and time windows without exposing an exact routine or address.
          </Text>
          <Button label="Manage availability" onPress={() => router.push('/availability')} />
        </View>
      </Screen>
    );
  }

  const catchKind: 'now' | 'scheduled' = mode === 'now' ? 'now' : 'scheduled';
  const labels = copy[catchKind];

  async function submit() {
    if (!selectedActivity) {
      setError('Choose an activity.');
      return;
    }
    if (!selectedVenue) {
      setError('Choose a public venue.');
      return;
    }
    if (!title.trim()) {
      setError('Give your Catch a short title.');
      return;
    }
    if (startsAt.getTime() <= Date.now()) {
      setError('Choose a start time in the future.');
      return;
    }
    if (!session) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
      return;
    }

    setIsSaving(true);
    setError('');
    const input: CatchInput = {
      activityTypeId: selectedActivity.id,
      approvalRequired,
      capacity,
      description: note,
      durationMinutes,
      hostId: session.user.id,
      intensity,
      kind: catchKind,
      minimumAge,
      startsAt: startsAt.toISOString(),
      title,
      venue: selectedVenue,
    };
    const result = editingId
      ? await updateCatch(editingId, input)
      : await createCatch(input);
    setIsSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/my-catches');
  }

  const startLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(startsAt);

  return (
    <Screen>
      <Text style={styles.eyebrow}>{editingId ? 'EDIT YOUR CATCH' : labels.eyebrow}</Text>
      <Text style={styles.title}>{editingId ? 'Tune up the plan.' : labels.title}</Text>
      <Text style={styles.subtitle}>{labels.subtitle}</Text>

      <Text style={styles.label}>Activity</Text>
      <View style={styles.activityGrid}>
        {catalog.map((activity) => {
          const selected = activity.slug === activitySlug;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={activity.id}
              onPress={() => setActivitySlug(activity.slug)}
              style={[styles.activity, selected && styles.activitySelected]}>
              <Text style={styles.emoji}>{activity.emoji}</Text>
              <Text style={[styles.activityName, selected && styles.activityNameSelected]}>
                {activity.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Catch title</Text>
      <TextInput
        accessibilityLabel="Catch title"
        maxLength={100}
        onChangeText={setTitle}
        placeholder="e.g. Golden-hour long toss"
        placeholderTextColor={colors.muted}
        style={styles.input}
        value={title}
      />

      <Text style={styles.label}>When</Text>
      {mode === 'now' ? (
        <View style={styles.chips}>
          {nowOffsets.map((offset) => (
            <Chip
              key={offset}
              label={`In ${offset < 60 ? `${offset} min` : `${offset / 60} hr${offset > 60 ? 's' : ''}`}`}
              onPress={() => setNowOffsetMinutes(offset)}
              selected={nowOffsetMinutes === offset}
            />
          ))}
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.horizontalChoices}
            horizontal
            showsHorizontalScrollIndicator={false}>
            {dayOptions.map((option) => (
              <Chip
                key={option.offset}
                label={option.label}
                onPress={() => setScheduledDay(option.offset)}
                selected={scheduledDay === option.offset}
              />
            ))}
          </ScrollView>
          <View style={styles.chips}>
            {scheduledHours.map((option) => (
              <Chip
                key={option.hour}
                label={option.label}
                onPress={() => setScheduledHour(option.hour)}
                selected={scheduledHour === option.hour}
              />
            ))}
          </View>
        </>
      )}

      <Text style={styles.label}>Duration</Text>
      <View style={styles.chips}>
        {durations.map((duration) => (
          <Chip
            key={duration}
            label={`${duration} min`}
            onPress={() => setDurationMinutes(duration)}
            selected={durationMinutes === duration}
          />
        ))}
      </View>

      <Text style={styles.label}>Public venue</Text>
      <View style={styles.venueList}>
        {venues.map((venue) => {
          const selected = venue.id === venueId;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={venue.id}
              onPress={() => setVenueId(venue.id)}
              style={[styles.venue, selected && styles.venueSelected]}>
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
              <View style={styles.venueText}>
                <Text style={styles.venueName}>{venue.name}</Text>
                <Text style={styles.venueArea}>
                  {venue.areaLabel}
                  {venue.addressDisplay ? ` · ${venue.addressDisplay}` : ''}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.helper}>
        Only public venues are offered here. Private-address coordination will use a protected
        approval flow later.
      </Text>

      <Text style={styles.label}>Crew size</Text>
      <View style={styles.counterRow}>
        <Pressable
          accessibilityLabel="Decrease crew size"
          disabled={capacity <= 2}
          onPress={() => setCapacity((value) => Math.max(2, value - 1))}
          style={styles.counterButton}>
          <Ionicons color={colors.forest} name="remove" size={20} />
        </Pressable>
        <View style={styles.counterValue}>
          <Text style={styles.counterNumber}>{capacity}</Text>
          <Text style={styles.counterCaption}>people total</Text>
        </View>
        <Pressable
          accessibilityLabel="Increase crew size"
          disabled={capacity >= 12}
          onPress={() => setCapacity((value) => Math.min(12, value + 1))}
          style={styles.counterButton}>
          <Ionicons color={colors.forest} name="add" size={20} />
        </Pressable>
      </View>

      <Text style={styles.label}>Vibe</Text>
      <View style={styles.chips}>
        {vibes.map((vibe) => (
          <Chip
            key={vibe}
            label={vibe}
            onPress={() => setIntensity(vibe)}
            selected={intensity === vibe}
          />
        ))}
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: approvalRequired }}
        onPress={() => setApprovalRequired((value) => !value)}
        style={styles.settingRow}>
        <View style={[styles.checkbox, approvalRequired && styles.checkboxSelected]}>
          {approvalRequired ? <Ionicons color={colors.white} name="checkmark" size={16} /> : null}
        </View>
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>Approve people before they join</Text>
          <Text style={styles.settingDetail}>Recommended while Catch is building trust.</Text>
        </View>
      </Pressable>

      {profile?.age21Affirmed ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: minimumAge === 21 }}
          onPress={() => setMinimumAge((value) => (value === 21 ? 18 : 21))}
          style={styles.settingRow}>
          <View style={[styles.checkbox, minimumAge === 21 && styles.checkboxSelected]}>
            {minimumAge === 21 ? <Ionicons color={colors.white} name="checkmark" size={16} /> : null}
          </View>
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Make this a 21+ Catch</Text>
            <Text style={styles.settingDetail}>Only users who affirmed 21+ will be eligible.</Text>
          </View>
        </Pressable>
      ) : null}

      <Text style={styles.label}>Anything worth knowing?</Text>
      <TextInput
        accessibilityLabel="Optional catch description"
        maxLength={1000}
        multiline
        onChangeText={setNote}
        placeholder="Extra glove available, field two, water breaks encouraged…"
        placeholderTextColor={colors.muted}
        style={styles.note}
        value={note}
      />
      <Text style={styles.noteCounter}>{note.length}/1000</Text>

      <View style={styles.preview}>
        <View style={[styles.previewIcon, { backgroundColor: selectedActivity?.color }]}>
          <Text style={styles.previewEmoji}>{selectedActivity?.emoji ?? '🏅'}</Text>
        </View>
        <View style={styles.previewText}>
          <Text style={styles.previewEyebrow}>YOUR PREVIEW</Text>
          <Text style={styles.previewTitle}>{title.trim() || 'Untitled Catch'}</Text>
          <Text style={styles.previewBody}>
            {startLabel} · {durationMinutes} min · {capacity} people
          </Text>
          <Text style={styles.previewBody}>
            {selectedVenue?.name ?? 'Choose a venue'} · {minimumAge}+
          </Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        disabled={isLoading || isSaving}
        icon={editingId ? 'checkmark-circle' : 'paper-plane'}
        label={
          isLoading
            ? 'Loading…'
            : isSaving
              ? 'Saving…'
              : editingId
                ? 'Save changes'
                : labels.submit
        }
        onPress={submit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    marginTop: spacing.sm,
    color: colors.orangeDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    maxWidth: 420,
    color: colors.ink,
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: -1,
  },
  subtitle: {
    maxWidth: 470,
    marginTop: 5,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  label: {
    marginTop: spacing.lg,
    marginBottom: 8,
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  activity: {
    minWidth: 102,
    flexGrow: 1,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    padding: 8,
  },
  activitySelected: { borderColor: colors.forest, backgroundColor: colors.paleGreen },
  emoji: { fontSize: 23 },
  activityName: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  activityNameSelected: { color: colors.forest, fontWeight: '800' },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    color: colors.ink,
    fontSize: 14,
    paddingHorizontal: 14,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  horizontalChoices: { gap: 8, paddingBottom: 10 },
  venueList: { gap: 9 },
  venue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    padding: 13,
  },
  venueSelected: { borderColor: colors.grass, backgroundColor: colors.paleGreen },
  radio: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    backgroundColor: colors.white,
  },
  radioSelected: { borderColor: colors.forest },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.forest },
  venueText: { flex: 1, gap: 2 },
  venueName: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  venueArea: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  helper: { marginTop: 7, color: colors.muted, fontSize: 10, lineHeight: 15 },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  counterButton: {
    width: 43,
    height: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.paper,
  },
  counterValue: { minWidth: 78, alignItems: 'center' },
  counterNumber: { color: colors.ink, fontSize: 22, fontWeight: '900' },
  counterCaption: { color: colors.muted, fontSize: 10 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.paleGreen,
    padding: 13,
  },
  checkbox: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  checkboxSelected: { borderColor: colors.forest, backgroundColor: colors.forest },
  settingText: { flex: 1 },
  settingTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  settingDetail: { marginTop: 2, color: colors.muted, fontSize: 10 },
  note: {
    minHeight: 106,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    padding: 14,
    textAlignVertical: 'top',
  },
  noteCounter: { marginTop: 4, color: colors.muted, fontSize: 10, textAlign: 'right' },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.paleGreen,
    padding: 13,
  },
  previewIcon: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  previewEmoji: { fontSize: 27 },
  previewText: { flex: 1, gap: 2 },
  previewEyebrow: { color: colors.grass, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  previewTitle: { color: colors.forest, fontSize: 14, fontWeight: '800' },
  previewBody: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  error: { marginBottom: 12, color: colors.error, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  openCard: {
    alignItems: 'center',
    gap: 10,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    padding: spacing.xl,
  },
  openTitle: { color: colors.ink, fontSize: 19, fontWeight: '900', textAlign: 'center' },
  openBody: { maxWidth: 390, color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
