import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { colors, radius, shadows, spacing } from '@/constants/theme';
import { getActivity } from '@/data/demo';
import type { CatchListing } from '@/types/domain';

type ActivityCardProps = {
  item: CatchListing;
};

export function ActivityCard({ item }: ActivityCardProps) {
  const activity = getActivity(item.activityId);
  const spots = item.capacity - item.participants;

  return (
    <Link href={{ pathname: '/catch/[id]', params: { id: item.id } }} asChild>
      <Pressable
        accessibilityHint="Opens catch details"
        accessibilityLabel={`${item.title}, ${item.timeLabel}, ${spots} spots left`}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <View style={styles.topRow}>
          <View style={[styles.iconTile, { backgroundColor: activity.color }]}>
            <Text style={styles.emoji}>{activity.emoji}</Text>
          </View>
          <View style={styles.heading}>
            <View style={styles.labelRow}>
              <View style={[styles.kindPill, item.kind === 'now' && styles.nowPill]}>
                <Text style={[styles.kindText, item.kind === 'now' && styles.nowText]}>
                  {item.kind === 'now' ? 'CATCH NOW' : activity.name.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.distance}>{item.distanceMiles} mi</Text>
            </View>
            <Text numberOfLines={1} style={styles.title}>
              {item.title}
            </Text>
            <Text style={styles.subtype}>{item.subtype}</Text>
          </View>
        </View>

        <View style={styles.metaBlock}>
          <View style={styles.metaRow}>
            <Ionicons color={colors.forestSoft} name="time-outline" size={17} />
            <Text style={styles.metaText}>{item.timeLabel}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons color={colors.forestSoft} name="location-outline" size={17} />
            <Text numberOfLines={1} style={styles.metaText}>
              {item.venue}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.host}>
            <Avatar initials={item.hostInitials} size={30} />
            <Text style={styles.hostText}>Hosted by {item.host}</Text>
          </View>
          <View style={styles.spots}>
            <Ionicons color={colors.forest} name="people-outline" size={16} />
            <Text style={styles.spotsText}>{spots} spots</Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    padding: spacing.md,
    gap: 15,
    ...shadows.card,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.995 }],
  },
  topRow: {
    flexDirection: 'row',
    gap: 13,
  },
  iconTile: {
    width: 54,
    height: 54,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 28,
  },
  heading: {
    flex: 1,
    gap: 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kindPill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    backgroundColor: colors.paleGreen,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  nowPill: {
    backgroundColor: colors.paleOrange,
  },
  kindText: {
    color: colors.forest,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  nowText: {
    color: colors.orangeDark,
  },
  distance: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtype: {
    color: colors.muted,
    fontSize: 13,
  },
  metaBlock: {
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 13,
  },
  host: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hostText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  spots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.paleGreen,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  spotsText: {
    color: colors.forest,
    fontSize: 12,
    fontWeight: '800',
  },
});

