import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { ActivityCard } from '@/components/activity-card';
import { CatchMateRow } from '@/components/catch-mate-row';
import { PublicCatchHighlightCard } from '@/components/public-catch-highlight-card';
import { Avatar } from '@/components/ui/avatar';
import { SectionHeader } from '@/components/ui/section-header';
import { Screen } from '@/components/ui/screen';
import { activities, catches, catchMates } from '@/data/demo';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import {
  type CatchMatchNotification,
  listCatchMatchNotifications,
} from '@/services/matching-service';
import {
  type PublicCatchHighlight,
  listPublicCatchHighlights,
} from '@/services/catch-highlight-service';

export default function HomeScreen() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const [unreadMatches, setUnreadMatches] = useState(0);
  const [recentHighlight, setRecentHighlight] = useState<PublicCatchHighlight | null>(null);
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

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let active = true;
      void Promise.all([listCatchMatchNotifications(), listPublicCatchHighlights(1)]).then(
        ([result, highlightResult]) => {
          if (!active) return;
          if (!result.error) {
          setUnreadMatches(
            result.data.filter((item: CatchMatchNotification) => !item.readAt).length,
          );
          }
          if (!highlightResult.error) setRecentHighlight(highlightResult.data[0] ?? null);
        },
      );
      return () => {
        active = false;
      };
    }, [session]),
  );

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>{todayLabel}</Text>
          <Text style={styles.greeting}>Hey, {firstName}.</Text>
        </View>
        <View style={styles.headerActions}>
          {session ? (
            <Pressable
              accessibilityLabel={`${unreadMatches} matching Catch notifications`}
              onPress={() => router.push('/matches')}
              style={styles.notificationButton}>
              <Ionicons color={colors.forest} name="notifications-outline" size={21} />
              {unreadMatches ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{unreadMatches}</Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}
          <Pressable accessibilityLabel="Open profile" onPress={() => router.push('/(tabs)/profile')}>
            <Avatar initials={initials} size={45} tone="orange" />
          </Pressable>
        </View>
      </View>

      <View style={styles.quickNav}>
        <Pressable accessibilityRole="button" style={styles.location}>
          <Ionicons color={colors.forest} name="location" size={16} />
          <Text numberOfLines={1} style={styles.locationText}>
            {areaLabel} · {radiusMiles} mi
          </Text>
          <Ionicons color={colors.forest} name="chevron-down" size={15} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/my-catches')}
          style={({ pressed }) => [styles.myCatches, pressed && styles.pressed]}>
          <Ionicons color={colors.forest} name="clipboard-outline" size={16} />
          <Text style={styles.myCatchesText}>My Catches</Text>
        </Pressable>
      </View>

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
          action="Look back"
          onAction={() => router.push('/catch-highlights' as never)}
          title="Catch Highlights"
        />
        <Text style={styles.sectionSubtitle}>Real Catches, shared by the people who were there.</Text>
        {recentHighlight ? (
          <PublicCatchHighlightCard item={recentHighlight} />
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/catch-highlights' as never)}
            style={({ pressed }) => [styles.highlightCta, pressed && styles.pressed]}>
            <View style={styles.highlightCtaIcon}>
              <Ionicons color={colors.orangeDark} name="images-outline" size={24} />
            </View>
            <View style={styles.matesText}>
              <Text style={styles.matesTitle}>The good stuff lives here</Text>
              <Text style={styles.sectionSubtitle}>
                Completed Catches and photos shared with permission.
              </Text>
            </View>
            <Ionicons color={colors.muted} name="chevron-forward" size={20} />
          </Pressable>
        )}
      </View>

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
          action={session ? 'View mates' : 'View people'}
          onAction={() => router.push(session ? '/catch-mates' : '/(tabs)/discover')}
          title={session ? 'Catch Mates' : 'Open to Catch'}
        />
        <Text style={styles.sectionSubtitle}>
          {session
            ? 'Save good people and make the next plan in a few taps.'
            : 'Nearby people who are up for something.'}
        </Text>
        {session ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/catch-mates')}
            style={({ pressed }) => [styles.matesCta, pressed && styles.pressed]}>
            <View style={styles.matesIcon}>
              <Ionicons color={colors.forest} name="people" size={23} />
            </View>
            <View style={styles.matesText}>
              <Text style={styles.matesTitle}>Open your Catch Mates</Text>
              <Text style={styles.sectionSubtitle}>Friend codes, saved mates, and proposals</Text>
            </View>
            <Ionicons color={colors.muted} name="chevron-forward" size={20} />
          </Pressable>
        ) : (
          <View style={styles.cardList}>
            {catchMates.map((mate) => (
              <CatchMateRow key={mate.id} mate={mate} />
            ))}
          </View>
        )}
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notificationButton: {
    width: 43,
    height: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 15,
    backgroundColor: colors.paper,
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.orange,
  },
  notificationBadgeText: { color: colors.white, fontSize: 9, fontWeight: '900' },
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
  quickNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  location: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    backgroundColor: colors.paper,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  locationText: {
    flexShrink: 1,
    color: colors.forest,
    fontSize: 13,
    fontWeight: '700',
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
  matesCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    padding: 14,
  },
  matesIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: colors.paleGreen,
  },
  matesText: { flex: 1, gap: 2 },
  matesTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  highlightCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    padding: 14,
  },
  highlightCtaIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: colors.paleOrange,
  },
  cardList: {
    gap: 13,
  },
});
