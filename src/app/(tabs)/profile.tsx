import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Avatar } from '@/components/ui/avatar';
import { Screen } from '@/components/ui/screen';
import { colors, radius, spacing } from '@/constants/theme';
import { activities } from '@/data/demo';
import { useAuth } from '@/providers/auth-provider';
import { listAvailability } from '@/services/availability-service';
import { listEquipment } from '@/services/equipment-service';
import { getMyEditableProfile } from '@/services/profile-service';
import {
  getMyScoutingReport,
  type ScoutingReport,
} from '@/services/post-catch-review-service';
import { buildScoutingSummary } from '@/services/post-catch-review-utils';
import { formatMemberName } from '@/utils/member-name';

type Setting = {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  detail: string;
  onPress?: () => void;
};

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, session, signOut } = useAuth();
  const [equipmentDetail, setEquipmentDetail] = useState('Nothing added yet');
  const [availabilityDetail, setAvailabilityDetail] = useState('Not set yet');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [scoutingReport, setScoutingReport] = useState<ScoutingReport>({
    averageScore: null,
    completedCatchCount: 0,
    ratingCount: 0,
    reliablePercent: 0,
    topTraits: [],
    wouldAgainPercent: 0,
  });
  const displayName = profile
    ? formatMemberName(profile.firstName, profile.lastInitial)
    : 'Blake';
  const initials =
    displayName
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'C';
  const selectedActivities = profile
    ? activities.filter((activity) => profile.activitySlugs.includes(activity.id)).slice(0, 3)
    : activities.filter((activity) => ['baseball', 'football', 'frisbee'].includes(activity.id));
  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let active = true;
      void Promise.all([
        listEquipment(session.user.id),
        listAvailability(session.user.id),
        getMyEditableProfile(session.user.id),
        getMyScoutingReport(),
      ]).then(([equipment, availability, editableProfile, scouting]) => {
        if (!active) return;
        if (!equipment.error) {
          const shareable = equipment.data.filter((item) => item.canShare).length;
          setEquipmentDetail(
            equipment.data.length
              ? `${equipment.data.length} ${equipment.data.length === 1 ? 'item' : 'items'} · ${shareable} shareable`
              : 'Nothing added yet',
          );
        }
        if (!availability.error) {
          const days = [...new Set(availability.data.map((window) => window.weekday))];
          const timeWindows = [...new Set(availability.data.map((window) => window.broadPeriod))];
          const dayLabel =
            days.length <= 2 ? days.map((day) => dayNames[day]).join(' & ') : `${days.length} days`;
          const timeLabel =
            timeWindows.length === 1
              ? `${timeWindows[0]}s`
              : `${timeWindows.length} time windows`;
          setAvailabilityDetail(
            days.length && timeWindows.length ? `${dayLabel} · ${timeLabel}` : 'Not set yet',
          );
        }
        if (!editableProfile.error) setPhotoUrl(editableProfile.data?.photoUrl ?? null);
        if (!scouting.error) setScoutingReport(scouting.data);
      });
      return () => {
        active = false;
      };
    }, [session]),
  );

  const visibleSettings: Setting[] = session
    ? [
        {
          icon: 'person-outline',
          label: 'Edit profile',
          detail: 'Photo, activities, bio',
          onPress: () => router.push('/edit-profile'),
        },
        {
          icon: 'basketball-outline',
          label: 'Equipment',
          detail: equipmentDetail,
          onPress: () => router.push('/equipment'),
        },
        {
          icon: 'time-outline',
          label: 'Availability',
          detail: availabilityDetail,
          onPress: () => router.push('/availability'),
        },
        {
          icon: 'people-outline',
          label: 'Catch Mates',
          detail: 'Saved people and direct proposals',
          onPress: () => router.push('/catch-mates'),
        },
        {
          icon: 'images-outline',
          label: 'Catch History',
          detail: 'Completed Catches and memories',
          onPress: () => router.push('/catch-history' as never),
        },
        { icon: 'shield-checkmark-outline', label: 'Privacy & safety', detail: 'Ratings hidden' },
        {
          icon: 'notifications-outline',
          label: 'Notifications',
          detail: 'Push alerts and preferences',
          onPress: () => router.push('/notification-settings'),
        },
      ]
    : [
        { icon: 'person-outline', label: 'Edit profile', detail: 'Photo, activities, bio' },
        { icon: 'basketball-outline', label: 'Equipment', detail: '4 items · 1 extra glove' },
        { icon: 'time-outline', label: 'Availability', detail: 'Wed & Fri afternoons' },
        { icon: 'shield-checkmark-outline', label: 'Privacy & safety', detail: 'Ratings hidden' },
        {
          icon: 'notifications-outline',
          label: 'Notifications',
          detail: 'Push alerts and preferences',
          onPress: () => router.push('/notification-settings'),
        },
      ];

  async function leaveAccount() {
    if (session) {
      const result = await signOut();
      if (result.error) return;
    }
    router.replace('/welcome');
  }

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={styles.wordmark}>CATCH</Text>
        <Pressable accessibilityLabel="Profile settings" style={styles.settingsButton}>
          <Ionicons color={colors.forest} name="settings-outline" size={21} />
        </Pressable>
      </View>

      <View style={styles.profileHeader}>
        <Avatar initials={initials} photoUrl={photoUrl} size={82} tone="orange" />
        <View style={styles.profileText}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{displayName}</Text>
            <Ionicons color={colors.grass} name="checkmark-circle" size={19} />
          </View>
          <Text style={styles.area}>{profile?.areaLabel ?? 'North Stafford, VA'}</Text>
          <View style={styles.activityLine}>
            {selectedActivities.map((activity, index) => (
              <View key={activity.id} style={styles.activityItem}>
                {index > 0 ? <Text style={styles.dot}>·</Text> : null}
                <Text style={styles.activityText}>
                  {activity.emoji} {activity.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <LinearGradient colors={['#153B29', '#2C6547']} style={styles.catchCard}>
        <View style={styles.cardHeading}>
          <View>
            <Text style={styles.cardEyebrow}>CATCH CARD</Text>
            <Text style={styles.cardName}>{displayName}’s scouting report</Text>
          </View>
          <Text style={styles.cardMark}>C</Text>
        </View>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{session ? scoutingReport.completedCatchCount : '12'}</Text>
            <Text style={styles.statLabel}>CATCHES</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {session
                ? scoutingReport.ratingCount
                  ? `${scoutingReport.reliablePercent}%`
                  : 'NEW'
                : '98%'}
            </Text>
            <Text style={styles.statLabel}>RELIABLE</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {session
                ? scoutingReport.ratingCount
                  ? `${scoutingReport.wouldAgainPercent}%`
                  : '—'
                : '100%'}
            </Text>
            <Text style={styles.statLabel}>AGAIN</Text>
          </View>
        </View>
        <View style={styles.scouting}>
          <Text style={styles.scoutingText}>
            {session
              ? `“${buildScoutingSummary(scoutingReport.ratingCount, scoutingReport.topTraits)}”`
              : '“Brings an extra glove. Doesn’t leave mates hanging.”'}
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.settingsList}>
        {visibleSettings.map((item) => (
          <Pressable
            accessibilityLabel={`${item.label}. ${item.detail}`}
            key={item.label}
            onPress={item.onPress}
            style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}>
            <View style={styles.settingIcon}>
              <Ionicons color={colors.forest} name={item.icon} size={20} />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>{item.label}</Text>
              <Text style={styles.settingDetail}>{item.detail}</Text>
            </View>
            {item.onPress ? (
              <Ionicons color={colors.muted} name="chevron-forward" size={19} />
            ) : null}
          </Pressable>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={leaveAccount}
        style={styles.demoButton}>
        <Text style={styles.demoButtonText}>
          {session ? 'Sign out' : 'Preview welcome & sign-in'}
        </Text>
      </Pressable>
      <Text style={styles.demoLabel}>
        {session?.user.email ?? 'Seeded demo mode · no precise location stored'}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  wordmark: {
    color: colors.forest,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 2.5,
  },
  settingsButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 15,
    backgroundColor: colors.paper,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: spacing.lg,
  },
  profileText: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  area: {
    color: colors.muted,
    fontSize: 13,
  },
  activityLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 3,
  },
  activityText: {
    color: colors.forest,
    fontSize: 11,
    fontWeight: '700',
  },
  activityItem: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    color: colors.muted,
    fontSize: 11,
  },
  catchCard: {
    overflow: 'hidden',
    marginTop: spacing.lg,
    borderRadius: 25,
    padding: 20,
  },
  cardHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardEyebrow: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  cardName: {
    marginTop: 3,
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
  },
  cardMark: {
    color: 'rgba(255,255,255,0.15)',
    fontSize: 45,
    fontWeight: '900',
    lineHeight: 46,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 22,
  },
  stat: {
    alignItems: 'center',
    gap: 3,
  },
  statValue: {
    color: colors.white,
    fontSize: 23,
    fontWeight: '900',
  },
  statLabel: {
    color: '#BDD1C3',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  statDivider: {
    width: 1,
    height: 37,
    backgroundColor: 'rgba(255,255,255,0.17)',
  },
  scouting: {
    marginTop: 17,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.09)',
    padding: 11,
  },
  scoutingText: {
    color: '#E7F0E9',
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  settingsList: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 68,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  pressed: {
    opacity: 0.72,
  },
  settingIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.paleGreen,
  },
  settingText: {
    flex: 1,
    gap: 2,
  },
  settingLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  settingDetail: {
    color: colors.muted,
    fontSize: 11,
  },
  demoButton: {
    alignItems: 'center',
    marginTop: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.paleOrange,
    padding: 14,
  },
  demoButtonText: {
    color: colors.orangeDark,
    fontSize: 13,
    fontWeight: '800',
  },
  demoLabel: {
    marginTop: 9,
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
  },
});
