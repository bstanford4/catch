import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import {
  type AvailabilityPeriod,
  type AvailabilitySelection,
  listAvailability,
  saveAvailability,
} from '@/services/availability-service';

const weekdays = [
  { label: 'Sunday', shortLabel: 'Sun', value: 0 },
  { label: 'Monday', shortLabel: 'Mon', value: 1 },
  { label: 'Tuesday', shortLabel: 'Tue', value: 2 },
  { label: 'Wednesday', shortLabel: 'Wed', value: 3 },
  { label: 'Thursday', shortLabel: 'Thu', value: 4 },
  { label: 'Friday', shortLabel: 'Fri', value: 5 },
  { label: 'Saturday', shortLabel: 'Sat', value: 6 },
];

const periods: { label: string; value: AvailabilityPeriod }[] = [
  { label: 'Morning', value: 'morning' },
  { label: 'Afternoon', value: 'afternoon' },
  { label: 'Evening', value: 'evening' },
];

export default function AvailabilityScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [selections, setSelections] = useState<AvailabilitySelection[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;

    let active = true;
    void listAvailability(session.user.id).then((result) => {
      if (!active) return;
      if (result.error) {
        setError(result.error);
      } else {
        setSelections(
          result.data.map((window) => ({
            broadPeriod: window.broadPeriod,
            weekday: window.weekday,
          })),
        );
      }
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [session]);

  function isSelected(weekday: number, broadPeriod: AvailabilityPeriod) {
    return selections.some(
      (selection) =>
        selection.weekday === weekday && selection.broadPeriod === broadPeriod,
    );
  }

  function toggleWindow(weekday: number, broadPeriod: AvailabilityPeriod) {
    setMessage('');
    setSelections((current) =>
      current.some(
        (selection) =>
          selection.weekday === weekday && selection.broadPeriod === broadPeriod,
      )
        ? current.filter(
            (selection) =>
              selection.weekday !== weekday || selection.broadPeriod !== broadPeriod,
          )
        : [...current, { broadPeriod, weekday }],
    );
  }

  async function save() {
    if (!session) {
      setError('Sign in to save availability.');
      return;
    }
    setIsSaving(true);
    setError('');
    setMessage('');
    const result = await saveAvailability(session.user.id, selections);
    setIsSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMessage(
      selections.length
        ? 'Your weekly availability is saved.'
        : 'Your availability has been cleared.',
    );
  }

  return (
    <Screen>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>YOUR RHYTHM</Text>
        <Text style={styles.title}>When are you usually free?</Text>
        <Text style={styles.intro}>
          Choose any combination for each day. Monday afternoon and Saturday morning?
          That works.
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Weekly availability</Text>
            <Text style={styles.sectionHint}>Tap every broad window that usually works.</Text>
          </View>
          {selections.length ? (
            <Pressable onPress={() => setSelections([])} style={styles.clearButton}>
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.schedule}>
          {weekdays.map((day) => (
            <View key={day.value} style={styles.dayRow}>
              <View style={styles.dayLabel}>
                <Text style={styles.dayShort}>{day.shortLabel}</Text>
              </View>
              <View style={styles.periodChoices}>
                {periods.map((period) => {
                  const selected = isSelected(day.value, period.value);
                  return (
                    <Pressable
                      accessibilityLabel={`${day.label} ${period.label}`}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      key={period.value}
                      onPress={() => toggleWindow(day.value, period.value)}
                      style={({ pressed }) => [
                        styles.periodChip,
                        selected && styles.periodSelected,
                        pressed && styles.pressed,
                      ]}>
                      {selected ? (
                        <Ionicons color={colors.white} name="checkmark" size={14} />
                      ) : null}
                      <Text style={[styles.periodText, selected && styles.periodTextSelected]}>
                        {period.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.privacyNote}>
        <Ionicons color={colors.forest} name="shield-checkmark" size={20} />
        <Text style={styles.privacyText}>
          Catch shares only broad overlaps such as “Monday afternoons.” Your choices stay
          saved until you change or clear them.
        </Text>
      </View>

      {isLoading ? <Text style={styles.status}>Loading your availability...</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}
      <Button
        disabled={isLoading || isSaving}
        label={isSaving ? 'Saving...' : 'Save availability'}
        onPress={save}
      />

      {selections.length ? (
        <View style={styles.matchCard}>
          <Ionicons color={colors.forest} name="people-outline" size={21} />
          <View style={styles.matchText}>
            <Text style={styles.matchTitle}>Ready to see who lines up?</Text>
            <Text style={styles.matchBody}>
              Open to Catch uses these exact day-and-time combinations for matching.
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Open matching people"
            onPress={() =>
              router.push({ pathname: '/create/[mode]', params: { mode: 'open' } })
            }>
            <Ionicons color={colors.forest} name="arrow-forward-circle" size={28} />
          </Pressable>
        </View>
      ) : !isLoading ? (
        <Text style={styles.clearHint}>Saving an empty schedule clears your availability.</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { marginTop: spacing.md, gap: 7 },
  eyebrow: {
    color: colors.orangeDark,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  intro: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  section: { marginTop: spacing.xl, gap: 12 },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  sectionHint: { marginTop: 3, color: colors.muted, fontSize: 11 },
  clearButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.paleGreen,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  clearText: { color: colors.forest, fontSize: 11, fontWeight: '900' },
  schedule: {
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    padding: 10,
  },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayLabel: {
    width: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayShort: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  periodChoices: { flex: 1, flexDirection: 'row', gap: 6 },
  periodChip: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    paddingHorizontal: 4,
  },
  periodSelected: { borderColor: colors.forest, backgroundColor: colors.forest },
  periodText: { color: colors.forest, fontSize: 10, fontWeight: '800' },
  periodTextSelected: { color: colors.white },
  privacyNote: {
    flexDirection: 'row',
    gap: 11,
    marginVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.paleGreen,
    padding: 14,
  },
  privacyText: { flex: 1, color: colors.forest, fontSize: 12, lineHeight: 18 },
  status: { marginBottom: 12, color: colors.muted, textAlign: 'center' },
  error: { marginBottom: 12, color: colors.error, fontSize: 13, textAlign: 'center' },
  success: {
    marginBottom: 12,
    color: colors.forest,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  clearHint: { marginTop: 10, color: colors.muted, fontSize: 11, textAlign: 'center' },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.paleGreen,
    padding: 12,
  },
  matchText: { flex: 1, gap: 2 },
  matchTitle: { color: colors.forest, fontSize: 12, fontWeight: '900' },
  matchBody: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  pressed: { opacity: 0.75 },
});
