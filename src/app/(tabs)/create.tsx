import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { activities } from '@/data/demo';
import { colors, radius, shadows, spacing } from '@/constants/theme';

type CreateMode = 'now' | 'scheduled' | 'open';

const options: {
  mode: CreateMode;
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  badge: string;
  description: string;
  color: string;
}[] = [
  {
    mode: 'now',
    icon: 'flash',
    title: 'Catch Now',
    badge: 'TODAY',
    description: 'I want to play in the next few hours.',
    color: colors.paleOrange,
  },
  {
    mode: 'scheduled',
    icon: 'calendar',
    title: 'Post a Catch',
    badge: 'PLAN IT',
    description: 'Set a date, place, and number of people.',
    color: colors.paleGreen,
  },
  {
    mode: 'open',
    icon: 'radio',
    title: 'Open to Catch',
    badge: 'STANDING',
    description: 'Share broad availability and let people propose.',
    color: '#E8E7F5',
  },
];

export default function CreateScreen() {
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.headingRow}>
        <Text style={styles.eyebrow}>MAKE A PLAN</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/my-catches')}
          style={({ pressed }) => [styles.myCatches, pressed && styles.pressed]}>
          <Ionicons color={colors.forest} name="clipboard-outline" size={16} />
          <Text style={styles.myCatchesText}>My Catches</Text>
        </Pressable>
      </View>
      <Text style={styles.title}>What sounds good?</Text>
      <Text style={styles.subtitle}>A few taps between you and a much better afternoon.</Text>

      <View style={styles.options}>
        {options.map((option) => (
          <Pressable
            accessibilityLabel={`${option.title}. ${option.description}`}
            key={option.mode}
            onPress={() =>
              router.push({ pathname: '/create/[mode]', params: { mode: option.mode } })
            }
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
            <View style={[styles.optionIcon, { backgroundColor: option.color }]}>
              <Ionicons
                color={option.mode === 'now' ? colors.orangeDark : colors.forest}
                name={option.icon}
                size={26}
              />
            </View>
            <View style={styles.optionContent}>
              <View style={styles.optionHeading}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.badge}>{option.badge}</Text>
              </View>
              <Text style={styles.optionDescription}>{option.description}</Text>
            </View>
            <Ionicons color={colors.muted} name="arrow-forward" size={22} />
          </Pressable>
        ))}
      </View>

      <Text style={styles.quickTitle}>Your usual suspects</Text>
      <View style={styles.activityGrid}>
        {activities.slice(0, 6).map((activity) => (
          <Pressable
            accessibilityLabel={`Start a ${activity.name} catch`}
            key={activity.id}
            onPress={() =>
              router.push({
                pathname: '/create/[mode]',
                params: { mode: 'scheduled', activity: activity.id },
              })
            }
            style={({ pressed }) => [styles.activity, pressed && styles.pressed]}>
            <Text style={styles.emoji}>{activity.emoji}</Text>
            <Text style={styles.activityName}>{activity.name}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.safetyNote}>
        <Ionicons color={colors.forest} name="shield-checkmark" size={20} />
        <Text style={styles.safetyText}>
          Private addresses stay private until you approve who’s coming.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  eyebrow: {
    color: colors.orangeDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  myCatches: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    backgroundColor: colors.paper,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  myCatchesText: { color: colors.forest, fontSize: 11, fontWeight: '800' },
  title: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  subtitle: {
    maxWidth: 360,
    marginTop: 4,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  options: {
    gap: 12,
    marginTop: spacing.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    minHeight: 92,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    padding: spacing.md,
    ...shadows.card,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  optionIcon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  optionContent: {
    flex: 1,
    gap: 4,
  },
  optionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  badge: {
    borderRadius: radius.pill,
    backgroundColor: colors.cream,
    color: colors.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  optionDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  quickTitle: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  activity: {
    width: '31%',
    minWidth: 100,
    minHeight: 78,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
  },
  emoji: {
    fontSize: 25,
  },
  activityName: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  safetyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.paleGreen,
    padding: 14,
  },
  safetyText: {
    flex: 1,
    color: colors.forest,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
});
