import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Screen } from '@/components/ui/screen';
import { StatePanel } from '@/components/ui/state-panel';
import { colors, radius, shadows, spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { listAvailability } from '@/services/availability-service';
import {
  type CompatibleOpenPerson,
  type OpenToCatchListing,
  closeOpenToCatch,
  getMyOpenToCatch,
  listCompatibleOpenPeople,
  publishOpenToCatch,
} from '@/services/matching-service';

export function OpenToCatchExperience() {
  const router = useRouter();
  const { session } = useAuth();
  const [listing, setListing] = useState<OpenToCatchListing | null>(null);
  const [people, setPeople] = useState<CompatibleOpenPerson[]>([]);
  const [hasAvailability, setHasAvailability] = useState(false);
  const [hours, setHours] = useState(48);
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError('');
    const [availabilityResult, listingResult] = await Promise.all([
      listAvailability(session.user.id),
      getMyOpenToCatch(),
    ]);
    setHasAvailability(availabilityResult.data.length > 0);
    setListing(listingResult.data);
    const baseError = availabilityResult.error ?? listingResult.error;
    if (listingResult.data) {
      const peopleResult = await listCompatibleOpenPeople();
      setPeople(peopleResult.data);
      setError(baseError ?? peopleResult.error ?? '');
    } else {
      setPeople([]);
      setError(baseError ?? '');
    }
    setIsLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function publish() {
    setIsSaving(true);
    setError('');
    const result = await publishOpenToCatch(hours);
    if (result.error) {
      setError(result.error);
      setIsSaving(false);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await load();
    setIsSaving(false);
  }

  async function close() {
    setIsSaving(true);
    const result = await closeOpenToCatch();
    setIsSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setListing(null);
    setPeople([]);
  }

  return (
    <Screen>
      <Text style={styles.eyebrow}>OPEN TO CATCH</Text>
      <Text style={styles.title}>Let a good plan find you.</Text>
      <Text style={styles.subtitle}>
        Catch privately compares broad availability and activities. Only members who turn this
        on can appear to one another.
      </Text>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.orange} />
          <Text style={styles.muted}>Checking your matches...</Text>
        </View>
      ) : null}
      {!isLoading && !session ? (
        <StatePanel
          body="Create an account to publish availability and see compatible people."
          icon="person-outline"
          title="Sign in first"
        />
      ) : null}
      {!isLoading && session && !hasAvailability ? (
        <StatePanel
          action="Set availability"
          body="Choose broad days and time periods first. Exact routines and addresses are never shown."
          icon="time-outline"
          onAction={() => router.push('/availability')}
          title="Tell Catch when you are usually free"
        />
      ) : null}

      {!isLoading && session && hasAvailability && !listing ? (
        <View style={styles.publishCard}>
          <View style={styles.cardHeading}>
            <View style={styles.statusIcon}>
              <Ionicons color={colors.forest} name="radio-outline" size={24} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Turn on Open to Catch</Text>
              <Text style={styles.muted}>
                Compatible people can see only your first name, broad area, shared activities,
                and overlapping windows.
              </Text>
            </View>
          </View>
          <Text style={styles.smallLabel}>Stay open for</Text>
          <View style={styles.chips}>
            {[24, 48, 72].map((option) => (
              <Chip
                key={option}
                label={`${option} hours`}
                onPress={() => setHours(option)}
                selected={hours === option}
              />
            ))}
          </View>
          <Button
            disabled={isSaving}
            icon="radio"
            label={isSaving ? 'Turning it on...' : 'Turn on Open to Catch'}
            onPress={publish}
          />
        </View>
      ) : null}

      {listing ? (
        <>
          <View style={styles.activeCard}>
            <View style={styles.activeTop}>
              <View style={styles.liveDot} />
              <Text style={styles.activeTitle}>You are Open to Catch</Text>
              <Text style={styles.activeUntil}>
                until{' '}
                {new Intl.DateTimeFormat('en-US', {
                  weekday: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                }).format(new Date(listing.expiresAt))}
              </Text>
            </View>
            <Text style={styles.activeSummary}>{listing.broadAvailability}</Text>
            <View style={styles.activeActions}>
              <Pressable
                disabled={isSaving}
                onPress={publish}
                style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}>
                <Ionicons color={colors.forest} name="refresh" size={16} />
                <Text style={styles.refreshText}>Refresh {hours}h</Text>
              </Pressable>
              <Pressable disabled={isSaving} onPress={close} style={styles.closeButton}>
                <Text style={styles.closeText}>Turn off</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>People who line up</Text>
              <Text style={styles.count}>{people.length}</Text>
            </View>
            {people.length === 0 ? (
              <StatePanel
                body="No one active nearby shares both an activity and an availability window yet."
                icon="sparkles-outline"
                title="You are first on the field"
              />
            ) : (
              people.map((person) => {
                const activity = person.activities[0];
                const overlap = person.overlapLabels[0];
                return (
                  <View key={person.userId} style={styles.personCard}>
                    <View style={[styles.activityIcon, { backgroundColor: activity.color }]}>
                      <Text style={styles.emoji}>{activity.emoji}</Text>
                    </View>
                    <View style={styles.personBody}>
                      <Text style={styles.personName}>{person.firstName} also wants to play</Text>
                      <Text style={styles.matchReason}>
                        You both chose {activity.name} and {overlap}.
                      </Text>
                      <Text style={styles.area}>{person.areaLabel}</Text>
                    </View>
                    <Pressable
                      accessibilityLabel={`Propose a Catch with ${person.firstName}`}
                      onPress={() =>
                        router.push({
                          pathname: '/propose/[mateId]',
                          params: {
                            activity: activity.id,
                            mateId: person.userId,
                            name: person.firstName,
                          },
                        })
                      }
                      style={({ pressed }) => [styles.proposeButton, pressed && styles.pressed]}>
                      <Ionicons color={colors.white} name="paper-plane-outline" size={18} />
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {session && hasAvailability ? (
        <Pressable onPress={() => router.push('/availability')} style={styles.availabilityLink}>
          <Ionicons color={colors.forest} name="time-outline" size={17} />
          <Text style={styles.availabilityText}>Review saved availability</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { marginTop: spacing.sm, color: colors.orangeDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 31, fontWeight: '900', letterSpacing: -1 },
  subtitle: { maxWidth: 500, marginTop: 5, color: colors.muted, fontSize: 13, lineHeight: 20 },
  loading: { alignItems: 'center', gap: 9, marginTop: spacing.xl },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  publishCard: {
    gap: 14,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    padding: spacing.md,
    ...shadows.card,
  },
  cardHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  statusIcon: {
    width: 45,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: colors.paleGreen,
  },
  cardText: { flex: 1, gap: 3 },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  smallLabel: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  activeCard: {
    gap: 10,
    marginTop: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.forest,
    padding: spacing.md,
  },
  activeTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.gold },
  activeTitle: { color: colors.white, fontSize: 14, fontWeight: '900' },
  activeUntil: { flex: 1, color: '#BCD0C2', fontSize: 10, textAlign: 'right' },
  activeSummary: { color: '#E3ECE5', fontSize: 11, lineHeight: 17 },
  activeActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  refreshButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 40,
    borderRadius: 13,
    backgroundColor: colors.white,
  },
  refreshText: { color: colors.forest, fontSize: 11, fontWeight: '800' },
  closeButton: { alignItems: 'center', justifyContent: 'center', minHeight: 40, paddingHorizontal: 10 },
  closeText: { color: '#FFD7C8', fontSize: 11, fontWeight: '800' },
  section: { gap: 11, marginTop: spacing.xl },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  count: {
    borderRadius: radius.pill,
    backgroundColor: colors.paleGreen,
    color: colors.forest,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    padding: 13,
  },
  activityIcon: {
    width: 49,
    height: 49,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  emoji: { fontSize: 25 },
  personBody: { flex: 1, gap: 2 },
  personName: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  matchReason: { color: colors.forest, fontSize: 11, lineHeight: 16 },
  area: { color: colors.muted, fontSize: 10 },
  proposeButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.orange,
  },
  availabilityLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.lg,
    minHeight: 44,
  },
  availabilityText: { color: colors.forest, fontSize: 12, fontWeight: '800' },
  error: { marginTop: spacing.md, color: colors.error, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  pressed: { opacity: 0.75 },
});
