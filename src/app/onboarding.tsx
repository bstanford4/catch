import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { activities } from '@/data/demo';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

const radiusOptions = [5, 10, 25, 50];

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeProfile, session } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [areaLabel, setAreaLabel] = useState('');
  const [selectedActivities, setSelectedActivities] = useState<string[]>(['baseball']);
  const [preferredRadiusMiles, setPreferredRadiusMiles] = useState(10);
  const [age21Affirmed, setAge21Affirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isValid =
    firstName.trim().length > 0 &&
    areaLabel.trim().length > 1 &&
    selectedActivities.length > 0 &&
    !isSubmitting;

  function toggleActivity(slug: string) {
    setSelectedActivities((current) =>
      current.includes(slug)
        ? current.filter((activity) => activity !== slug)
        : [...current, slug],
    );
  }

  async function submit() {
    if (!isValid) return;
    setIsSubmitting(true);
    setError('');
    const result = await completeProfile({
      activitySlugs: selectedActivities,
      age21Affirmed,
      areaLabel,
      firstName,
      preferredRadiusMiles,
    });
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.replace('/');
  }

  return (
    <Screen>
      <View style={styles.progress}>
        <View style={styles.progressFill} />
      </View>
      <Text style={styles.eyebrow}>BUILD YOUR CATCH CARD</Text>
      <Text style={styles.title}>A few basics, then let’s play.</Text>
      <Text style={styles.subtitle}>
        Your exact address is never part of your public profile. Broad areas keep discovery useful
        without advertising where you live.
      </Text>

      <Text style={styles.label}>What should people call you?</Text>
      <View style={styles.inputWrap}>
        <Ionicons color={colors.muted} name="person-outline" size={19} />
        <TextInput
          accessibilityLabel="First name"
          autoCapitalize="words"
          autoComplete="name-given"
          maxLength={60}
          onChangeText={setFirstName}
          placeholder="First name"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={firstName}
        />
      </View>

      <Text style={styles.label}>What general area are you in?</Text>
      <View style={styles.inputWrap}>
        <Ionicons color={colors.muted} name="location-outline" size={19} />
        <TextInput
          accessibilityLabel="General area"
          autoCapitalize="words"
          maxLength={100}
          onChangeText={setAreaLabel}
          placeholder="Example: North Stafford"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={areaLabel}
        />
      </View>
      <View style={styles.privacyNote}>
        <Ionicons color={colors.forest} name="shield-checkmark" size={17} />
        <Text style={styles.privacyText}>Neighborhood or town only—never enter a street address.</Text>
      </View>

      <Text style={styles.label}>What do you want to play?</Text>
      <Text style={styles.helper}>Choose at least one. You can change these anytime.</Text>
      <View style={styles.activityGrid}>
        {activities.map((activity) => {
          const selected = selectedActivities.includes(activity.id);
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              key={activity.id}
              onPress={() => toggleActivity(activity.id)}
              style={[styles.activity, selected && styles.activitySelected]}>
              <Text style={styles.emoji}>{activity.emoji}</Text>
              <Text style={[styles.activityName, selected && styles.activityNameSelected]}>
                {activity.name}
              </Text>
              {selected ? (
                <View style={styles.activityCheck}>
                  <Ionicons color={colors.white} name="checkmark" size={11} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>How far would you travel?</Text>
      <View style={styles.radiusRow}>
        {radiusOptions.map((miles) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: preferredRadiusMiles === miles }}
            key={miles}
            onPress={() => setPreferredRadiusMiles(miles)}
            style={[styles.radiusOption, preferredRadiusMiles === miles && styles.radiusSelected]}>
            <Text
              style={[
                styles.radiusText,
                preferredRadiusMiles === miles && styles.radiusTextSelected,
              ]}>
              {miles} mi
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: age21Affirmed }}
        onPress={() => setAge21Affirmed((value) => !value)}
        style={styles.checkRow}>
        <View style={[styles.checkbox, age21Affirmed && styles.checkboxChecked]}>
          {age21Affirmed ? <Ionicons color={colors.white} name="checkmark" size={17} /> : null}
        </View>
        <View style={styles.checkCopy}>
          <Text style={styles.checkTitle}>I’m also 21 or older</Text>
          <Text style={styles.checkText}>
            Optional. This enables 21+ and BYOB-friendly labels; alcohol is never required.
          </Text>
        </View>
      </Pressable>

      {error ? (
        <View accessibilityLiveRegion="polite" style={styles.error}>
          <Ionicons color={colors.error} name="alert-circle" size={18} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.submit}>
        <Button
          disabled={!isValid}
          label={isSubmitting ? 'Saving your profile…' : 'Finish my profile'}
          onPress={submit}
        />
      </View>
      <Text style={styles.email}>{session?.user.email}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: {
    height: 5,
    overflow: 'hidden',
    marginTop: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.line,
  },
  progressFill: {
    width: '65%',
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.orange,
  },
  eyebrow: {
    marginTop: spacing.xl,
    color: colors.orangeDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    maxWidth: 430,
    color: colors.ink,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  subtitle: {
    maxWidth: 520,
    marginTop: 8,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  label: {
    marginTop: spacing.lg,
    marginBottom: 7,
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  helper: {
    marginTop: -3,
    marginBottom: 9,
    color: colors.muted,
    fontSize: 11,
  },
  inputWrap: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 8,
  },
  privacyText: {
    color: colors.forest,
    fontSize: 11,
    fontWeight: '700',
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activity: {
    position: 'relative',
    minWidth: '23%',
    flexGrow: 1,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    padding: 8,
  },
  activitySelected: {
    borderColor: colors.forest,
    backgroundColor: colors.paleGreen,
  },
  emoji: {
    fontSize: 24,
  },
  activityName: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  activityNameSelected: {
    color: colors.forest,
    fontWeight: '800',
  },
  activityCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: colors.forest,
  },
  radiusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusOption: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
  },
  radiusSelected: {
    borderColor: colors.forest,
    backgroundColor: colors.forest,
  },
  radiusText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  radiusTextSelected: {
    color: colors.white,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    padding: 14,
  },
  checkbox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 7,
    backgroundColor: colors.paper,
  },
  checkboxChecked: {
    borderColor: colors.forest,
    backgroundColor: colors.forest,
  },
  checkCopy: {
    flex: 1,
    gap: 2,
  },
  checkTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  checkText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#F8E4E0',
    padding: 12,
  },
  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  submit: {
    marginTop: spacing.xl,
  },
  email: {
    marginTop: 9,
    color: colors.muted,
    fontSize: 10,
    textAlign: 'center',
  },
});

