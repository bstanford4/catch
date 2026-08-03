import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { colors, radius, shadows, spacing } from '@/constants/theme';
import { activities as demoActivities } from '@/data/demo';
import { useAuth } from '@/providers/auth-provider';
import { type SavedCatchMate, listCatchMates } from '@/services/catch-mate-service';
import { type CatchCatalogActivity, loadCatchCatalog } from '@/services/catch-service';
import { logPastCatch } from '@/services/past-catch-service';

const durationOptions = [30, 45, 60, 90];

function defaultPastDate() {
  const value = new Date();
  value.setDate(value.getDate() - 1);
  value.setHours(18, 0, 0, 0);
  return value;
}

function dateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
  const parsed = new Date(year, month - 1, day, hour, minute);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) return null;
  return parsed;
}

const demoCatalog: CatchCatalogActivity[] = demoActivities.map((activity) => ({
  ...activity,
  slug: activity.id,
}));

export default function LogPastCatchScreen() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const [initialFields] = useState(() => {
    const initialDate = defaultPastDate();
    return { date: dateInputValue(initialDate), time: timeInputValue(initialDate) };
  });
  const [catalog, setCatalog] = useState<CatchCatalogActivity[]>(demoCatalog);
  const [mates, setMates] = useState<SavedCatchMate[]>([]);
  const [activityId, setActivityId] = useState(demoCatalog[0]?.id ?? '');
  const [title, setTitle] = useState('Baseball catch');
  const automaticTitle = useRef('Baseball catch');
  const [dateValue, setDateValue] = useState(initialFields.date);
  const [timeValue, setTimeValue] = useState(initialFields.time);
  const [duration, setDuration] = useState(45);
  const [customDuration, setCustomDuration] = useState('');
  const [locationType, setLocationType] = useState<'custom_public' | 'private'>('custom_public');
  const [venueName, setVenueName] = useState('');
  const [areaLabel, setAreaLabel] = useState(profile?.areaLabel ?? '');
  const [selectedMateIds, setSelectedMateIds] = useState<string[]>([]);
  const [guestNote, setGuestNote] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;
    let active = true;
    void Promise.all([loadCatchCatalog(), listCatchMates()]).then(([catalogResult, matesResult]) => {
      if (!active) return;
      if (catalogResult.activities.length) {
        setCatalog(catalogResult.activities);
        const first = catalogResult.activities[0];
        setActivityId(first.id);
        const nextTitle = `${first.name} catch`;
        setTitle(nextTitle);
        automaticTitle.current = nextTitle;
      }
      setMates(matesResult.data);
      if (profile?.areaLabel) setAreaLabel((current) => current || profile.areaLabel);
      setError(catalogResult.error ?? matesResult.error ?? '');
      setIsLoading(false);
    });
    return () => { active = false; };
  }, [profile?.areaLabel, session]);

  function selectActivity(activity: CatchCatalogActivity) {
    const nextTitle = `${activity.name} catch`;
    if (!title.trim() || title.trim() === automaticTitle.current) setTitle(nextTitle);
    automaticTitle.current = nextTitle;
    setActivityId(activity.id);
  }

  function toggleMate(id: string) {
    setSelectedMateIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function save() {
    const startsAt = parseLocalDateTime(dateValue, timeValue);
    const effectiveDuration = customDuration ? Number(customDuration) : duration;
    if (!session) {
      setError('Sign in before logging a past Catch.');
      return;
    }
    if (!activityId || !title.trim()) {
      setError('Choose an activity and give the Catch a title.');
      return;
    }
    if (!startsAt) {
      setError('Use YYYY-MM-DD for the date and 24-hour HH:MM for the time.');
      return;
    }
    if (!Number.isInteger(effectiveDuration) || effectiveDuration < 15 || effectiveDuration > 480) {
      setError('Duration must be a whole number from 15 to 480 minutes.');
      return;
    }
    if (startsAt.getTime() + effectiveDuration * 60_000 > Date.now()) {
      setError('A past Catch must already be over.');
      return;
    }
    if (!areaLabel.trim()) {
      setError('Enter the broad area where the Catch happened.');
      return;
    }
    if (locationType === 'custom_public' && !venueName.trim()) {
      setError('Enter the public place name.');
      return;
    }

    setIsSaving(true);
    setError('');
    const result = await logPastCatch({
      activityTypeId: activityId,
      areaLabel,
      description,
      durationMinutes: effectiveDuration,
      guestNote,
      inviteeIds: selectedMateIds,
      locationType,
      startsAt: startsAt.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      title,
      venueName,
    });
    setIsSaving(false);
    if (result.error || !result.data) {
      setError(result.error ?? 'The past Catch could not be logged.');
      return;
    }
    router.replace(`/catch-memories/${result.data}` as never);
  }

  return (
    <Screen>
      <Text style={styles.eyebrow}>ADD TO YOUR HISTORY</Text>
      <Text style={styles.title}>Log a past Catch</Text>
      <Text style={styles.subtitle}>
        Capture something that already happened. It will not appear as an upcoming Catch.
      </Text>

      <View style={styles.safetyCard}>
        <Ionicons color={colors.forest} name="shield-checkmark-outline" size={21} />
        <Text style={styles.safetyText}>
          Catch Mates you select will confirm they were there before it appears in their history.
        </Text>
      </View>

      {isLoading ? <ActivityIndicator color={colors.orange} style={styles.loading} /> : null}
      <Section title="What did you play?">
        <View style={styles.activityGrid}>
          {catalog.map((activity) => {
            const selected = activity.id === activityId;
            return (
              <Pressable
                accessibilityRole="button"
                key={activity.id}
                onPress={() => selectActivity(activity)}
                style={[styles.activity, selected && styles.selected]}>
                <Text style={styles.emoji}>{activity.emoji}</Text>
                <Text style={[styles.activityName, selected && styles.selectedText]}>{activity.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <Field label="Catch title">
          <TextInput
            accessibilityLabel="Catch title"
            maxLength={100}
            onChangeText={setTitle}
            style={styles.input}
            value={title}
          />
        </Field>
      </Section>

      <Section title="When was it?">
        <View style={styles.inputRow}>
          <Field label="Date (YYYY-MM-DD)" style={styles.flex}>
            <TextInput
              accessibilityLabel="Past Catch date"
              autoCapitalize="none"
              onChangeText={setDateValue}
              placeholder="2026-08-01"
              style={styles.input}
              value={dateValue}
            />
          </Field>
          <Field label="Time (HH:MM)" style={styles.flex}>
            <TextInput
              accessibilityLabel="Past Catch time"
              autoCapitalize="none"
              onChangeText={setTimeValue}
              placeholder="18:00"
              style={styles.input}
              value={timeValue}
            />
          </Field>
        </View>
        <Text style={styles.fieldLabel}>Duration</Text>
        <View style={styles.chipRow}>
          {durationOptions.map((value) => (
            <Pressable
              key={value}
              onPress={() => { setDuration(value); setCustomDuration(''); }}
              style={[styles.chip, !customDuration && duration === value && styles.selected]}>
              <Text style={[styles.chipText, !customDuration && duration === value && styles.selectedText]}>
                {value} min
              </Text>
            </Pressable>
          ))}
        </View>
        <Field label="Or enter minutes">
          <TextInput
            accessibilityLabel="Custom duration in minutes"
            keyboardType="number-pad"
            maxLength={3}
            onChangeText={(value) => setCustomDuration(value.replace(/\D/g, ''))}
            placeholder="e.g. 75"
            style={styles.input}
            value={customDuration}
          />
        </Field>
      </Section>

      <Section title="Where did it happen?">
        <View style={styles.choiceRow}>
          <Choice
            label="Public place"
            onPress={() => setLocationType('custom_public')}
            selected={locationType === 'custom_public'}
          />
          <Choice
            label="Private / informal"
            onPress={() => setLocationType('private')}
            selected={locationType === 'private'}
          />
        </View>
        {locationType === 'custom_public' ? (
          <Field label="Place name">
            <TextInput
              accessibilityLabel="Public place name"
              maxLength={120}
              onChangeText={setVenueName}
              placeholder="e.g. Jones Park"
              style={styles.input}
              value={venueName}
            />
          </Field>
        ) : null}
        <Field label="Broad area">
          <TextInput
            accessibilityLabel="Broad Catch area"
            maxLength={100}
            onChangeText={setAreaLabel}
            placeholder="e.g. North Stafford"
            style={styles.input}
            value={areaLabel}
          />
        </Field>
        {locationType === 'private' ? (
          <Text style={styles.help}>Exact private addresses are not saved in this history entry.</Text>
        ) : null}
      </Section>

      <Section title="Who was there?">
        <Text style={styles.help}>
          Select Catch Mates to ask them to confirm. Their names are not added until they accept.
        </Text>
        {mates.length ? mates.map((mate) => {
          const selected = selectedMateIds.includes(mate.id);
          return (
            <Pressable key={mate.id} onPress={() => toggleMate(mate.id)} style={[styles.mate, selected && styles.mateSelected]}>
              <Ionicons
                color={selected ? colors.white : colors.forest}
                name={selected ? 'checkbox' : 'square-outline'}
                size={23}
              />
              <View style={styles.flex}>
                <Text style={[styles.mateName, selected && styles.mateNameSelected]}>{mate.firstName}</Text>
                <Text style={[styles.help, selected && styles.mateHelpSelected]}>{mate.areaLabel}</Text>
              </View>
            </Pressable>
          );
        }) : <Text style={styles.help}>No Catch Mates yet. You can still log this for yourself.</Text>}
        <Field label="Private note about anyone not on Catch (optional)">
          <TextInput
            accessibilityLabel="Private off-app guest note"
            maxLength={200}
            multiline
            onChangeText={setGuestNote}
            placeholder="e.g. A friend who isn't on Catch yet"
            style={[styles.input, styles.multiline]}
            value={guestNote}
          />
        </Field>
        <Text style={styles.help}>This note stays private and is never used as a public participant name.</Text>
      </Section>

      <Section title="Anything worth remembering?">
        <TextInput
          accessibilityLabel="Past Catch note"
          maxLength={1000}
          multiline
          onChangeText={setDescription}
          placeholder="Optional note about the Catch"
          style={[styles.input, styles.multiline]}
          value={description}
        />
      </Section>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        disabled={isSaving || isLoading}
        icon="checkmark-circle-outline"
        label={isSaving ? 'Logging Catch...' : 'Log completed Catch'}
        onPress={save}
      />
    </Screen>
  );
}

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function Field({ children, label, style }: { children: React.ReactNode; label: string; style?: object }) {
  return <View style={[styles.field, style]}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>;
}

function Choice({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, selected && styles.selected]}>
      <Ionicons color={selected ? colors.white : colors.forest} name={selected ? 'radio-button-on' : 'radio-button-off'} size={19} />
      <Text style={[styles.chipText, selected && styles.selectedText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  eyebrow: { marginTop: spacing.sm, color: colors.orangeDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 31, fontWeight: '900', letterSpacing: -0.8 },
  subtitle: { marginTop: 4, color: colors.muted, fontSize: 13, lineHeight: 19 },
  safetyCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.paleGreen, padding: spacing.md },
  safetyText: { flex: 1, color: colors.forest, fontSize: 12, lineHeight: 18 },
  loading: { marginTop: spacing.lg },
  section: { gap: 12, marginVertical: spacing.lg, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: colors.paper, padding: spacing.md, ...shadows.card },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  activity: { width: '31%', minWidth: 96, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 6, paddingVertical: 12 },
  selected: { borderColor: colors.forest, backgroundColor: colors.forest },
  emoji: { fontSize: 25 },
  activityName: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  selectedText: { color: colors.white },
  field: { gap: 6 },
  fieldLabel: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.white, color: colors.ink, fontSize: 14, paddingHorizontal: 14, paddingVertical: 12 },
  multiline: { minHeight: 86, textAlignVertical: 'top' },
  inputRow: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 10 },
  chipText: { color: colors.forest, fontSize: 11, fontWeight: '800' },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 8 },
  help: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  mate: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 12 },
  mateSelected: { borderColor: colors.forest, backgroundColor: colors.forest },
  mateName: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  mateNameSelected: { color: colors.white },
  mateHelpSelected: { color: colors.paleGreen },
  error: { marginBottom: spacing.md, color: colors.error, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
