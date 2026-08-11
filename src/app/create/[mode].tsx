import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { OpenToCatchExperience } from '@/components/open-to-catch-experience';
import { Screen } from '@/components/ui/screen';
import { colors, radius, spacing } from '@/constants/theme';
import { activities as demoActivities } from '@/data/demo';
import { useAuth } from '@/providers/auth-provider';
import { formatMemberName } from '@/utils/member-name';
import {
  type HostCatchInvitation,
  listHostCatchInvitations,
  syncCatchMateInvitations,
} from '@/services/catch-invitation-service';
import { listCatchMates, type SavedCatchMate } from '@/services/catch-mate-service';
import {
  type CatchCatalogActivity,
  type CatchInput,
  type CatchLocationType,
  type CatchVenue,
  createCatch,
  getHostedCatch,
  getPrivateCatchLocation,
  loadCatchCatalog,
  updateCatch,
} from '@/services/catch-service';

const durations = [30, 45, 60, 90];
const vibes = ['Easygoing', 'Beginner-friendly', 'Bring the heat'];
const otherActivity: CatchCatalogActivity = {
  color: '#F6EADF',
  emoji: '✨',
  id: 'other',
  name: 'Other',
  slug: 'other',
};

const demoCatalog: CatchCatalogActivity[] = [
  ...demoActivities.map((activity) => ({
    color: activity.color,
    emoji: activity.emoji,
    id: activity.id,
    name: activity.name,
    slug: activity.id,
  })),
  otherActivity,
];
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

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function timeInputValue(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function parseLocalDateTime(dateValue: string, timeValue: string) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(timeValue.trim());
  if (!dateMatch || !timeMatch) return null;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (hour > 23 || minute > 59) return null;
  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

export default function CreateModeScreen() {
  const params = useLocalSearchParams<{ activity?: string; catchId?: string; mode?: string }>();
  const router = useRouter();
  const { profile, session } = useAuth();
  const isOpenToCatch = params.mode === 'open';
  const editingId = params.catchId;
  const initialActivity =
    demoActivities.find((activity) => activity.id === params.activity) ?? demoActivities[0];
  const [catalog, setCatalog] = useState<CatchCatalogActivity[]>(demoCatalog);
  const [venues, setVenues] = useState<CatchVenue[]>(demoVenues);
  const [activitySlug, setActivitySlug] = useState(initialActivity.id);
  const [customActivityName, setCustomActivityName] = useState('');
  const [venueId, setVenueId] = useState(demoVenues[0].id);
  const [locationType, setLocationType] = useState<CatchLocationType>('catalog');
  const [customVenueName, setCustomVenueName] = useState('');
  const [customVenueArea, setCustomVenueArea] = useState(profile?.areaLabel ?? '');
  const [privatePlaceName, setPrivatePlaceName] = useState('');
  const [privateAddress, setPrivateAddress] = useState('');
  const [privateArrivalNotes, setPrivateArrivalNotes] = useState('');
  const [privateLocationConfirmed, setPrivateLocationConfirmed] = useState(false);
  const [title, setTitle] = useState(`${initialActivity.name} catch`);
  const automaticTitle = useRef<string | null>(
    editingId ? null : `${initialActivity.name} catch`,
  );
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [customDuration, setCustomDuration] = useState(false);
  const [customDurationText, setCustomDurationText] = useState('75');
  const [timingMode, setTimingMode] = useState<'asap' | 'hour' | 'tomorrow' | 'custom'>(
    params.mode === 'now' ? 'asap' : 'tomorrow',
  );
  const [baseNow] = useState(() => new Date());
  const initialCustomStart = new Date(baseNow.getTime() + 60 * 60_000);
  const [customDate, setCustomDate] = useState(dateInputValue(initialCustomStart));
  const [customTime, setCustomTime] = useState(timeInputValue(initialCustomStart));
  const [capacity, setCapacity] = useState(4);
  const [mates, setMates] = useState<SavedCatchMate[]>([]);
  const [selectedMateIds, setSelectedMateIds] = useState<string[]>([]);
  const [invitationStatuses, setInvitationStatuses] = useState<
    Record<string, 'pending' | 'accepted'>
  >({});
  const [savedCatchId, setSavedCatchId] = useState<string | null>(null);
  const [intensity, setIntensity] = useState('Easygoing');
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [minimumAge, setMinimumAge] = useState<18 | 21>(18);
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;
    let active = true;
    void Promise.all([
      loadCatchCatalog(),
      editingId
        ? getHostedCatch(editingId, session.user.id)
        : Promise.resolve({ data: null, error: null }),
      editingId
        ? getPrivateCatchLocation(editingId)
        : Promise.resolve({ data: null, error: null }),
      listCatchMates(),
      editingId
        ? listHostCatchInvitations(editingId)
        : Promise.resolve({ data: [], error: null }),
    ]).then(([
      catalogResult,
      catchResult,
      privateLocationResult,
      mateResult,
      invitationResult,
    ]) => {
      if (!active) return;
      if (catalogResult.error) {
        setError(catalogResult.error);
      } else {
        const preferredSlugs = profile?.activitySlugs ?? [];
        const loadedActivities = catalogResult.activities.some(
          (activity) => activity.slug === 'other',
        )
          ? catalogResult.activities
          : [...catalogResult.activities, otherActivity];
        const sorted = [...loadedActivities].sort((a, b) => {
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
          setLocationType(catalogResult.venues[0] ? 'catalog' : 'custom_public');
          if (chosen) {
            const nextTitle = `${chosen.name} catch`;
            automaticTitle.current = nextTitle;
            setTitle(nextTitle);
          }
        }
      }

      if (catchResult.error) {
        setError(catchResult.error);
      } else if (editingId && !catchResult.data) {
        setError('That Catch could not be found or is no longer editable.');
      } else if (catchResult.data) {
        const item = catchResult.data;
        setActivitySlug(item.activity.slug);
        setCustomActivityName(item.customActivityName ?? '');
        setVenueId(item.venue?.id ?? 'other');
        setLocationType(item.locationType);
        setCustomVenueName(item.customVenueName ?? '');
        setCustomVenueArea(item.customVenueArea ?? profile?.areaLabel ?? '');
        automaticTitle.current = null;
        setTitle(item.title);
        setDurationMinutes(item.durationMinutes);
        setCustomDuration(!durations.includes(item.durationMinutes));
        setCustomDurationText(String(item.durationMinutes));
        setCapacity(item.capacity);
        setIntensity(item.intensity);
        setApprovalRequired(item.approvalRequired);
        setMinimumAge(item.minimumAge);
        setNote(item.description);
        const start = new Date(item.startsAt);
        setCustomDate(dateInputValue(start));
        setCustomTime(timeInputValue(start));
        setTimingMode('custom');
      }
      if (privateLocationResult.error && catchResult.data?.locationType === 'private') {
        setError(privateLocationResult.error);
      } else if (privateLocationResult.data) {
        setPrivatePlaceName(privateLocationResult.data.placeName);
        setPrivateAddress(privateLocationResult.data.exactAddress);
        setPrivateArrivalNotes(privateLocationResult.data.arrivalNotes ?? '');
        setPrivateLocationConfirmed(true);
      }
      setMates(mateResult.data);
      if (mateResult.error) setError(mateResult.error);
      if (invitationResult.error) {
        setError(invitationResult.error);
      } else {
        const selectableInvitations = invitationResult.data.filter(
          (invitation: HostCatchInvitation) =>
            invitation.status === 'accepted' ||
            mateResult.data.some((mate: SavedCatchMate) => mate.id === invitation.inviteeId),
        );
        const statuses = Object.fromEntries(
          selectableInvitations.map((invitation: HostCatchInvitation) => [
            invitation.inviteeId,
            invitation.status,
          ]),
        );
        setInvitationStatuses(statuses);
        setSelectedMateIds(
          selectableInvitations.map((invitation: HostCatchInvitation) => invitation.inviteeId),
        );
      }
      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [
    editingId,
    params.activity,
    profile?.activitySlugs,
    profile?.areaLabel,
    session,
  ]);

  const selectedActivity =
    catalog.find((activity) => activity.slug === activitySlug) ?? catalog[0];
  const effectiveEditingId = editingId ?? savedCatchId;

  function toggleMate(mateId: string) {
    if (invitationStatuses[mateId] === 'accepted') return;
    setSelectedMateIds((current) => {
      if (current.includes(mateId)) return current.filter((id) => id !== mateId);
      if (current.length >= 11) {
        setError('A Catch can include up to 12 people including you.');
        return current;
      }
      const next = [...current, mateId];
      setCapacity((value) => Math.max(value, next.length + 1));
      return next;
    });
  }

  function selectActivity(activity: CatchCatalogActivity) {
    const previousAutomaticTitle = automaticTitle.current;
    const nextAutomaticTitle = `${activity.name} catch`;
    setActivitySlug(activity.slug);
    setTitle((current) =>
      previousAutomaticTitle !== null && current === previousAutomaticTitle
        ? nextAutomaticTitle
        : current,
    );
    automaticTitle.current = nextAutomaticTitle;
  }

  function changeCustomActivityName(value: string) {
    const previousAutomaticTitle = automaticTitle.current;
    const nextAutomaticTitle = `${value.trim() || 'Other'} catch`;
    setCustomActivityName(value);
    setTitle((current) =>
      activitySlug === 'other' &&
      previousAutomaticTitle !== null &&
      current === previousAutomaticTitle
        ? nextAutomaticTitle
        : current,
    );
    if (activitySlug === 'other') automaticTitle.current = nextAutomaticTitle;
  }

  const selectedVenue =
    locationType === 'catalog' ? venues.find((venue) => venue.id === venueId) ?? null : null;
  const effectiveDuration =
    customDuration && customDurationText.trim()
      ? Number(customDurationText)
      : customDuration
        ? Number.NaN
        : durationMinutes;
  const startsAt = useMemo(() => {
    if (timingMode === 'custom') return parseLocalDateTime(customDate, customTime);
    if (timingMode === 'asap' || timingMode === 'hour') {
      const offsetMinutes = timingMode === 'asap' ? 30 : 60;
      const date = new Date(baseNow.getTime() + offsetMinutes * 60_000);
      date.setSeconds(0, 0);
      return date;
    }
    const date = new Date(baseNow);
    date.setDate(date.getDate() + 1);
    date.setHours(18, 0, 0, 0);
    return date;
  }, [
    baseNow,
    customDate,
    customTime,
    timingMode,
  ]);
  const whenOptions = useMemo(() => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    const asap = new Date(baseNow.getTime() + 30 * 60_000);
    const hour = new Date(baseNow.getTime() + 60 * 60_000);
    const tomorrow = new Date(baseNow);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0);
    return [
      { detail: formatter.format(asap), id: 'asap' as const, title: 'As soon as possible' },
      { detail: formatter.format(hour), id: 'hour' as const, title: 'In 1 hour' },
      { detail: formatter.format(tomorrow), id: 'tomorrow' as const, title: 'Tomorrow evening' },
      {
        detail:
          timingMode === 'custom' && startsAt
            ? formatter.format(startsAt)
            : 'Enter one exact date and time',
        id: 'custom' as const,
        title: 'Choose a date & time',
      },
    ];
  }, [baseNow, startsAt, timingMode]);

  if (isOpenToCatch) {
    return <OpenToCatchExperience />;
  }

  const catchKind: 'now' | 'scheduled' =
    startsAt && startsAt.getTime() - baseNow.getTime() <= 3 * 60 * 60_000
      ? 'now'
      : 'scheduled';

  async function submit() {
    if (!selectedActivity) {
      setError('Choose an activity.');
      return;
    }
    if (activitySlug === 'other' && !customActivityName.trim()) {
      setError('Tell people what activity you have in mind.');
      return;
    }
    if (
      locationType === 'custom_public' &&
      (!customVenueName.trim() || !customVenueArea.trim())
    ) {
      setError('Enter the public place name and its general area.');
      return;
    }
    if (locationType === 'catalog' && !selectedVenue) {
      setError('Choose a public venue.');
      return;
    }
    if (
      locationType === 'private' &&
      (!privatePlaceName.trim() || !privateAddress.trim() || !customVenueArea.trim())
    ) {
      setError('Enter a private spot name, exact address, and broad area.');
      return;
    }
    if (locationType === 'private' && !privateLocationConfirmed) {
      setError('Confirm that you understand how the private location will be shared.');
      return;
    }
    if (locationType === 'later' && !customVenueArea.trim()) {
      setError('Enter the broad area where you expect to meet.');
      return;
    }
    if (!title.trim()) {
      setError('Give your Catch a short title.');
      return;
    }
    if (!startsAt) {
      setError('Enter a valid date and time using the examples shown.');
      return;
    }
    if (startsAt.getTime() <= Date.now()) {
      setError('Choose a start time in the future.');
      return;
    }
    if (
      !Number.isInteger(effectiveDuration) ||
      effectiveDuration < 15 ||
      effectiveDuration > 480
    ) {
      setError('Duration must be a whole number from 15 to 480 minutes.');
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
      customActivityName: activitySlug === 'other' ? customActivityName : '',
      customVenueArea: locationType === 'catalog' ? '' : customVenueArea,
      customVenueName: locationType === 'custom_public' ? customVenueName : '',
      description: note,
      durationMinutes: effectiveDuration,
      hostFirstName: profile
        ? formatMemberName(profile.firstName, profile.lastInitial)
        : 'Catch member',
      hostId: session.user.id,
      intensity,
      kind: catchKind,
      locationType,
      minimumAge,
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
      startsAt: startsAt.toISOString(),
      title,
      venue: locationType === 'catalog' ? selectedVenue : null,
    };
    let catchId = effectiveEditingId;
    if (catchId) {
      const updateResult = await updateCatch(catchId, input);
      if (updateResult.error) {
        setIsSaving(false);
        setError(updateResult.error);
        return;
      }
    } else {
      const createResult = await createCatch(input);
      if (createResult.error || !createResult.data) {
        setIsSaving(false);
        setError(createResult.error ?? 'Catch was not created.');
        return;
      }
      catchId = createResult.data;
      setSavedCatchId(catchId);
    }
    if (!catchId) {
      setIsSaving(false);
      setError('The Catch was saved without a valid identifier.');
      return;
    }
    const invitationResult = await syncCatchMateInvitations(catchId, selectedMateIds);
    setIsSaving(false);
    if (invitationResult.error) {
      setError(
        `The Catch was saved, but the invitations were not updated. Fix the selection and tap Save again. ${invitationResult.error}`,
      );
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/my-catches');
  }

  const startLabel = startsAt
    ? new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(startsAt)
    : 'Enter a valid date and time';

  return (
    <Screen>
      <Text style={styles.eyebrow}>{editingId ? 'EDIT YOUR CATCH' : 'CREATE A CATCH'}</Text>
      <Text style={styles.title}>{editingId ? 'Tune up the plan.' : 'What sounds good?'}</Text>
      <Text style={styles.subtitle}>
        Pick a rough time or plan ahead. It all becomes one clear Catch.
      </Text>

      <Text style={styles.label}>Activity</Text>
      <View style={styles.activityGrid}>
        {catalog.map((activity) => {
          const selected = activity.slug === activitySlug;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={activity.id}
              onPress={() => selectActivity(activity)}
              style={[styles.activity, selected && styles.activitySelected]}>
              <Text style={styles.emoji}>{activity.emoji}</Text>
              <Text style={[styles.activityName, selected && styles.activityNameSelected]}>
                {activity.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {activitySlug === 'other' ? (
        <View style={styles.revealFields}>
          <Text style={styles.revealLabel}>What activity?</Text>
          <TextInput
            accessibilityLabel="Custom activity"
            maxLength={60}
            onChangeText={changeCustomActivityName}
            placeholder="e.g. Wiffle ball, cornhole, kickball"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={customActivityName}
          />
        </View>
      ) : null}

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
      <View style={styles.whenList}>
        {whenOptions.map((option) => {
          const selected = timingMode === option.id;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.id}
              onPress={() => setTimingMode(option.id)}
              style={[styles.whenOption, selected && styles.whenOptionSelected]}>
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
              <View style={styles.whenText}>
                <Text style={styles.whenTitle}>{option.title}</Text>
                <Text style={styles.whenDetail}>{option.detail}</Text>
              </View>
              {option.id === 'custom' ? (
                <Ionicons color={colors.muted} name="calendar-outline" size={19} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {timingMode === 'custom' ? (
        <View style={styles.revealFields}>
          <Text style={styles.revealLabel}>Exact start</Text>
          <View style={styles.customFieldRow}>
            <View style={styles.customField}>
              <Text style={styles.smallLabel}>Date</Text>
              <TextInput
                accessibilityLabel="Custom start date"
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
                onChangeText={setCustomDate}
                placeholder="2026-07-26"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={customDate}
              />
            </View>
            <View style={styles.customField}>
              <Text style={styles.smallLabel}>Time (24-hour)</Text>
              <TextInput
                accessibilityLabel="Custom start time"
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
                onChangeText={setCustomTime}
                placeholder="18:30"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={customTime}
              />
            </View>
          </View>
          <Text style={styles.helper}>Example: 2026-07-28 at 18:30 means July 28 at 6:30 PM.</Text>
        </View>
      ) : null}

      <Text style={styles.label}>Duration</Text>
      <View style={styles.chips}>
        {durations.map((duration) => (
          <Chip
            key={duration}
            label={`${duration} min`}
            onPress={() => {
              setCustomDuration(false);
              setDurationMinutes(duration);
            }}
            selected={!customDuration && durationMinutes === duration}
          />
        ))}
        <Chip
          label="Other"
          onPress={() => setCustomDuration(true)}
          selected={customDuration}
        />
      </View>
      {customDuration ? (
        <View style={styles.revealFields}>
          <Text style={styles.revealLabel}>Custom duration in minutes</Text>
          <TextInput
            accessibilityLabel="Custom duration in minutes"
            keyboardType="number-pad"
            maxLength={3}
            onChangeText={(value) => setCustomDurationText(value.replace(/\D/g, ''))}
            placeholder="75"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={customDurationText}
          />
          <Text style={styles.helper}>Choose any whole number from 15 minutes to 8 hours.</Text>
        </View>
      ) : null}

      <Text style={styles.label}>Where</Text>
      <View style={styles.venueList}>
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
              }}
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
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: locationType === 'custom_public' }}
          onPress={() => setLocationType('custom_public')}
          style={[styles.venue, locationType === 'custom_public' && styles.venueSelected]}>
          <View style={[styles.radio, locationType === 'custom_public' && styles.radioSelected]}>
            {locationType === 'custom_public' ? <View style={styles.radioDot} /> : null}
          </View>
          <View style={styles.venueText}>
            <Text style={styles.venueName}>Other public place</Text>
            <Text style={styles.venueArea}>Enter a park, court, field, or other public venue</Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: locationType === 'private' }}
          onPress={() => {
            setLocationType('private');
            setApprovalRequired(true);
          }}
          style={[styles.venue, locationType === 'private' && styles.venueSelected]}>
          <View style={[styles.radio, locationType === 'private' && styles.radioSelected]}>
            {locationType === 'private' ? <View style={styles.radioDot} /> : null}
          </View>
          <View style={styles.venueText}>
            <Text style={styles.venueName}>Private spot</Text>
            <Text style={styles.venueArea}>
              A driveway, yard, home hoop, or another host-approved meeting spot
            </Text>
          </View>
          <Ionicons color={colors.forest} name="lock-closed-outline" size={18} />
        </Pressable>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: locationType === 'later' }}
          onPress={() => setLocationType('later')}
          style={[styles.venue, locationType === 'later' && styles.venueSelected]}>
          <View style={[styles.radio, locationType === 'later' && styles.radioSelected]}>
            {locationType === 'later' ? <View style={styles.radioDot} /> : null}
          </View>
          <View style={styles.venueText}>
            <Text style={styles.venueName}>Decide with the crew later</Text>
            <Text style={styles.venueArea}>Show only a broad area until everyone coordinates</Text>
          </View>
        </Pressable>
      </View>
      {locationType === 'custom_public' ? (
        <View style={styles.revealFields}>
          <Text style={styles.revealLabel}>Public place name</Text>
          <TextInput
            accessibilityLabel="Custom public place name"
            maxLength={100}
            onChangeText={setCustomVenueName}
            placeholder="e.g. Government Island Park"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={customVenueName}
          />
          <Text style={styles.revealLabel}>General area</Text>
          <TextInput
            accessibilityLabel="Custom public place general area"
            maxLength={100}
            onChangeText={setCustomVenueArea}
            placeholder="e.g. Stafford, VA"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={customVenueArea}
          />
          <View style={styles.locationWarning}>
            <Ionicons color={colors.orangeDark} name="shield-checkmark" size={18} />
            <Text style={styles.locationWarningText}>
              Public places only. Don’t enter a home address or another private location.
            </Text>
          </View>
        </View>
      ) : null}
      {locationType === 'private' ? (
        <View style={styles.revealFields}>
          <View style={styles.privateHeading}>
            <Ionicons color={colors.forest} name="shield-checkmark" size={20} />
            <View style={styles.venueText}>
              <Text style={styles.revealLabel}>Protected private location</Text>
              <Text style={styles.helperNoMargin}>
                Discover shows only the broad area. The exact details unlock after you approve
                someone.
              </Text>
            </View>
          </View>
          <Text style={styles.revealLabel}>Spot name</Text>
          <TextInput
            accessibilityLabel="Private spot name"
            maxLength={100}
            onChangeText={setPrivatePlaceName}
            placeholder="e.g. Blake's driveway hoop"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={privatePlaceName}
          />
          <Text style={styles.revealLabel}>Exact address or meeting instructions</Text>
          <TextInput
            accessibilityLabel="Private spot exact address"
            maxLength={300}
            onChangeText={setPrivateAddress}
            placeholder="Street address or precise meeting point"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={privateAddress}
          />
          <Text style={styles.revealLabel}>Broad area shown publicly</Text>
          <TextInput
            accessibilityLabel="Private spot broad public area"
            maxLength={100}
            onChangeText={setCustomVenueArea}
            placeholder="e.g. North Stafford"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={customVenueArea}
          />
          <Text style={styles.revealLabel}>Arrival notes (optional)</Text>
          <TextInput
            accessibilityLabel="Private spot arrival notes"
            maxLength={500}
            multiline
            onChangeText={setPrivateArrivalNotes}
            placeholder="e.g. Use the side gate; hoop is behind the blue car"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.privateNotes]}
            value={privateArrivalNotes}
          />
          <View style={styles.locationWarning}>
            <Ionicons color={colors.orangeDark} name="warning-outline" size={18} />
            <Text style={styles.locationWarningText}>
              If play may extend into a road, confirm it is legal, low-traffic, and safe. Never
              invite someone onto property you do not control.
            </Text>
          </View>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: privateLocationConfirmed }}
            onPress={() => setPrivateLocationConfirmed((value) => !value)}
            style={styles.privateConfirm}>
            <View style={[styles.checkbox, privateLocationConfirmed && styles.checkboxSelected]}>
              {privateLocationConfirmed ? (
                <Ionicons color={colors.white} name="checkmark" size={16} />
              ) : null}
            </View>
            <Text style={styles.privateConfirmText}>
              I understand the exact location is shared only with people I approve.
            </Text>
          </Pressable>
          <Text style={styles.helperNoMargin}>
            Secure coordinates are supported by the database; a visual drop-pin picker will be
            added when the production map provider is connected.
          </Text>
        </View>
      ) : null}
      {locationType === 'later' ? (
        <View style={styles.revealFields}>
          <Text style={styles.revealLabel}>Broad meeting area</Text>
          <TextInput
            accessibilityLabel="Broad meeting area"
            maxLength={100}
            onChangeText={setCustomVenueArea}
            placeholder="e.g. North Stafford"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={customVenueArea}
          />
          <Text style={styles.helperNoMargin}>
            No exact address is stored. You can coordinate a public or protected private spot
            after the crew forms.
          </Text>
        </View>
      ) : null}

      <Text style={styles.label}>Invite Catch Mates</Text>
      <Text style={styles.sectionHelper}>
        They will receive an invitation and choose whether to join. Private location details stay
        locked until they accept.
      </Text>
      <View style={styles.mateList}>
        {mates.map((mate) => {
          const selected = selectedMateIds.includes(mate.id);
          const invitationStatus = invitationStatuses[mate.id];
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled: invitationStatus === 'accepted' }}
              key={mate.id}
              onPress={() => toggleMate(mate.id)}
              style={[styles.mateRow, selected && styles.mateRowSelected]}>
              <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                {selected ? <Ionicons color={colors.white} name="checkmark" size={16} /> : null}
              </View>
              <View style={styles.settingText}>
                <Text style={styles.mateName}>{mate.firstName}</Text>
                <Text style={styles.settingDetail}>{mate.areaLabel}</Text>
              </View>
              {invitationStatus ? (
                <Text style={styles.invitationStatus}>
                  {invitationStatus === 'accepted' ? 'GOING' : 'INVITED'}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
        {!isLoading && mates.length === 0 ? (
          <Text style={styles.emptyMates}>
            You do not have any Catch Mates yet. You can still create the Catch and invite people
            later after connecting with them.
          </Text>
        ) : null}
      </View>
      {editingId && Object.values(invitationStatuses).includes('accepted') ? (
        <Text style={styles.sectionHelper}>
          Mates already marked Going are approved participants and cannot be removed here.
        </Text>
      ) : null}

      <Text style={styles.label}>Crew size</Text>
      <View style={styles.counterRow}>
        <Pressable
          accessibilityLabel="Decrease crew size"
          disabled={capacity <= Math.max(2, selectedMateIds.length + 1)}
          onPress={() => setCapacity((value) => Math.max(2, selectedMateIds.length + 1, value - 1))}
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
            {startLabel} · {Number.isFinite(effectiveDuration) ? effectiveDuration : '—'} min ·{' '}
            {capacity} people
          </Text>
          <Text style={styles.previewBody}>
            {locationType === 'custom_public'
              ? customVenueName.trim() || 'Enter a public place'
              : locationType === 'private'
                ? `Private spot near ${customVenueArea.trim() || 'your broad area'}`
                : locationType === 'later'
                  ? `Location near ${customVenueArea.trim() || 'your broad area'} decided later`
                  : selectedVenue?.name ?? 'Choose a venue'}{' '}
            · {minimumAge}+
          </Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        disabled={isLoading || isSaving}
        icon={effectiveEditingId ? 'checkmark-circle' : 'paper-plane'}
        label={
          isLoading
            ? 'Loading…'
            : isSaving
              ? 'Saving…'
              : effectiveEditingId
                ? 'Save changes'
                : 'Create this Catch'
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
  revealFields: {
    gap: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    padding: 13,
  },
  revealLabel: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  privateHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  privateNotes: { minHeight: 80, paddingTop: 14, textAlignVertical: 'top' },
  privateConfirm: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  privateConfirmText: { flex: 1, color: colors.ink, fontSize: 11, lineHeight: 16 },
  helperNoMargin: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  customFieldRow: { flexDirection: 'row', gap: 10 },
  customField: { flex: 1, gap: 6 },
  smallLabel: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  whenList: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
  },
  whenOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 64,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  whenOptionSelected: { backgroundColor: colors.paleGreen },
  whenText: { flex: 1, gap: 2 },
  whenTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  whenDetail: { color: colors.muted, fontSize: 10, lineHeight: 15 },
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
  locationWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.paleOrange,
    padding: 11,
  },
  locationWarningText: {
    flex: 1,
    color: colors.orangeDark,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 15,
  },
  sectionHelper: { marginBottom: 9, color: colors.muted, fontSize: 10, lineHeight: 15 },
  mateList: { gap: 8 },
  mateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 58,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    padding: 12,
  },
  mateRowSelected: { borderColor: colors.grass, backgroundColor: colors.paleGreen },
  mateName: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  invitationStatus: {
    borderRadius: radius.pill,
    backgroundColor: colors.cream,
    color: colors.forest,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  emptyMates: {
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    padding: 13,
  },
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
