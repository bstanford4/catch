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
  listAvailability,
  saveAvailability,
} from '@/services/availability-service';

const weekdays = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

const periods: { detail: string; label: string; value: AvailabilityPeriod }[] = [
  { detail: 'Before noon', label: 'Morning', value: 'morning' },
  { detail: 'Noon–5 PM', label: 'Afternoon', value: 'afternoon' },
  { detail: 'After 5 PM', label: 'Evening', value: 'evening' },
];

export default function AvailabilityScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedPeriods, setSelectedPeriods] = useState<AvailabilityPeriod[]>([]);
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
        setSelectedDays([...new Set(result.data.map((window) => window.weekday))]);
        setSelectedPeriods([...new Set(result.data.map((window) => window.broadPeriod))]);
      }
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [session]);

  function toggleDay(day: number) {
    setMessage('');
    setSelectedDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day],
    );
  }

  function togglePeriod(period: AvailabilityPeriod) {
    setMessage('');
    setSelectedPeriods((current) =>
      current.includes(period)
        ? current.filter((value) => value !== period)
        : [...current, period],
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
    const result = await saveAvailability(session.user.id, selectedDays, selectedPeriods);
    setIsSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMessage(
      selectedDays.length && selectedPeriods.length
        ? 'Availability saved for the next 90 days.'
        : 'Availability cleared.',
    );
  }

  return (
    <Screen>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>YOUR RHYTHM</Text>
        <Text style={styles.title}>When are you usually free?</Text>
        <Text style={styles.intro}>
          Pick broad windows—not an exact schedule. We’ll use these to surface better matches.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Days</Text>
        <View style={styles.dayGrid}>
          {weekdays.map((day) => {
            const selected = selectedDays.includes(day.value);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                key={day.value}
                onPress={() => toggleDay(day.value)}
                style={({ pressed }) => [
                  styles.day,
                  selected && styles.selected,
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.dayText, selected && styles.selectedText]}>{day.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Time of day</Text>
        <View style={styles.periodList}>
          {periods.map((period) => {
            const selected = selectedPeriods.includes(period.value);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                key={period.value}
                onPress={() => togglePeriod(period.value)}
                style={({ pressed }) => [
                  styles.period,
                  selected && styles.periodSelected,
                  pressed && styles.pressed,
                ]}>
                <View style={[styles.check, selected && styles.checkSelected]}>
                  {selected ? <Ionicons color={colors.white} name="checkmark" size={15} /> : null}
                </View>
                <View>
                  <Text style={styles.periodLabel}>{period.label}</Text>
                  <Text style={styles.periodDetail}>{period.detail}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.privacyNote}>
        <Ionicons color={colors.forest} name="shield-checkmark" size={20} />
        <Text style={styles.privacyText}>
          Catch only shows broad labels like “Wednesday afternoons.” These preferences expire
          after 90 days so they don’t become stale.
        </Text>
      </View>

      {isLoading ? <Text style={styles.status}>Loading your availability…</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}
      <Button
        disabled={isLoading || isSaving}
        label={isSaving ? 'Saving…' : 'Save availability'}
        onPress={save}
      />
      {selectedDays.length && selectedPeriods.length ? (
        <View style={styles.matchCard}>
          <Ionicons color={colors.forest} name="people-outline" size={21} />
          <View style={styles.matchText}>
            <Text style={styles.matchTitle}>Ready to see who lines up?</Text>
            <Text style={styles.matchBody}>
              Turn on Open to Catch to see people with overlapping activities and broad windows.
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
      ) : null}
      {(selectedDays.length === 0 || selectedPeriods.length === 0) && !isLoading ? (
        <Text style={styles.clearHint}>Saving with an empty selection clears your availability.</Text>
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
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  day: {
    alignItems: 'center',
    minWidth: 58,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    backgroundColor: colors.paper,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selected: { borderColor: colors.forest, backgroundColor: colors.forest },
  dayText: { color: colors.forest, fontSize: 13, fontWeight: '800' },
  selectedText: { color: colors.white },
  periodList: { gap: 10 },
  period: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    padding: 15,
  },
  periodSelected: { borderColor: colors.grass, backgroundColor: colors.paleGreen },
  check: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  checkSelected: { borderColor: colors.forest, backgroundColor: colors.forest },
  periodLabel: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  periodDetail: { marginTop: 2, color: colors.muted, fontSize: 11 },
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
  success: { marginBottom: 12, color: colors.forest, fontSize: 13, fontWeight: '700', textAlign: 'center' },
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
