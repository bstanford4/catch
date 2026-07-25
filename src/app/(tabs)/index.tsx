import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { ActivityCard } from '@/components/activity-card';
import { CatchMateRow } from '@/components/catch-mate-row';
import { Avatar } from '@/components/ui/avatar';
import { SectionHeader } from '@/components/ui/section-header';
import { Screen } from '@/components/ui/screen';
import { activities, catches, catchMates } from '@/data/demo';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const firstName = profile?.firstName ?? 'Blake';
  const initials =
    firstName
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'C';
  const areaLabel = profile?.areaLabel ?? 'North Stafford';
  const radiusMiles = profile?.preferredRadiusMiles ?? 10;
  const todayLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
    .format(new Date())
    .toUpperCase();

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>{todayLabel}</Text>
          <Text style={styles.greeting}>Hey, {firstName}.</Text>
        </View>
        <Pressable accessibilityLabel="Open profile" onPress={() => router.push('/(tabs)/profile')}>
          <Avatar initials={initials} size={45} tone="orange" />
        </Pressable>
      </View>

      <Pressable accessibilityRole="button" style={styles.location}>
        <Ionicons color={colors.forest} name="location" size={16} />
        <Text style={styles.locationText}>
          {areaLabel} · {radiusMiles} mi
        </Text>
        <Ionicons color={colors.forest} name="chevron-down" size={15} />
      </Pressable>

      <LinearGradient
        colors={[colors.forest, '#285E43']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.hero}>
        <View style={styles.heroBallOne} />
        <View style={styles.heroBallTwo} />
        <Text style={styles.heroKicker}>THE FIELD IS CALLING</Text>
        <Text style={styles.heroTitle}>Your next good hour starts here.</Text>
        <Text style={styles.heroBody}>Find someone nearby and go play something.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/create/[mode]', params: { mode: 'now' } })}
          style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}>
          <Ionicons color={colors.forest} name="flash" size={18} />
          <Text style={styles.heroButtonText}>Catch Now</Text>
          <Ionicons color={colors.forest} name="arrow-forward" size={18} />
        </Pressable>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.activityRow}
        horizontal
        showsHorizontalScrollIndicator={false}>
        {activities.slice(0, 6).map((activity) => (
          <Pressable
            accessibilityLabel={`Find ${activity.name}`}
            key={activity.id}
            onPress={() => router.push('/(tabs)/discover')}
            style={({ pressed }) => [styles.activity, pressed && styles.pressed]}>
            <View style={[styles.activityIcon, { backgroundColor: activity.color }]}>
              <Text style={styles.activityEmoji}>{activity.emoji}</Text>
            </View>
            <Text style={styles.activityName}>{activity.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.section}>
        <SectionHeader
          action="See all"
          onAction={() => router.push('/(tabs)/discover')}
          title="Happening nearby"
        />
        <Text style={styles.sectionSubtitle}>Good plans, already in motion.</Text>
        <View style={styles.cardList}>
          {catches.slice(0, 2).map((item) => (
            <ActivityCard item={item} key={item.id} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          action="View people"
          onAction={() => router.push('/(tabs)/discover')}
          title="Open to Catch"
        />
        <Text style={styles.sectionSubtitle}>Nearby people who are up for something.</Text>
        <View style={styles.cardList}>
          {catchMates.map((mate) => (
            <CatchMateRow key={mate.id} mate={mate} />
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  eyebrow: {
    color: colors.orangeDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  greeting: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1,
  },
  location: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    backgroundColor: colors.paper,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  locationText: {
    color: colors.forest,
    fontSize: 13,
    fontWeight: '700',
  },
  hero: {
    minHeight: 254,
    overflow: 'hidden',
    borderRadius: 27,
    padding: 24,
  },
  heroBallOne: {
    position: 'absolute',
    width: 180,
    height: 180,
    right: -80,
    top: -65,
    borderRadius: 90,
    borderWidth: 32,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  heroBallTwo: {
    position: 'absolute',
    width: 100,
    height: 100,
    right: 28,
    bottom: -60,
    borderRadius: 50,
    backgroundColor: 'rgba(245,190,79,0.13)',
  },
  heroKicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  heroTitle: {
    maxWidth: 290,
    marginTop: 8,
    color: colors.white,
    fontSize: 31,
    lineHeight: 35,
    fontWeight: '900',
    letterSpacing: -1,
  },
  heroBody: {
    maxWidth: 280,
    marginTop: 9,
    color: '#D7E6DC',
    fontSize: 14,
    lineHeight: 20,
  },
  heroButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 49,
    marginTop: 18,
    borderRadius: radius.md,
    backgroundColor: colors.gold,
    paddingHorizontal: 16,
  },
  heroButtonText: {
    color: colors.forest,
    fontSize: 15,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.82,
  },
  activityRow: {
    gap: 14,
    paddingVertical: spacing.lg,
  },
  activity: {
    alignItems: 'center',
    gap: 7,
  },
  activityIcon: {
    width: 55,
    height: 55,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(23,62,43,0.06)',
  },
  activityEmoji: {
    fontSize: 27,
  },
  activityName: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
  },
  section: {
    gap: 4,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionSubtitle: {
    color: colors.muted,
    fontSize: 13,
    marginBottom: 10,
  },
  cardList: {
    gap: 13,
  },
});
