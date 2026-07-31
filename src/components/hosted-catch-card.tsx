import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { colors, radius, shadows, spacing } from '@/constants/theme';
import type { HostedCatch } from '@/services/catch-service';
import { memberInitials } from '@/utils/member-name';

export function catchLocationLabel(item: HostedCatch) {
  if (item.locationType === 'private') return `Private spot near ${item.customVenueArea}`;
  if (item.locationType === 'later') return `Near ${item.customVenueArea} · exact spot later`;
  return item.customVenueName ?? item.venue?.name ?? item.customVenueArea ?? 'Location pending';
}

export function HostedCatchCard({ item }: { item: HostedCatch }) {
  const start = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(item.startsAt));
  const initials = memberInitials(item.hostFirstName);

  return (
    <Link href={{ pathname: '/catch/[id]', params: { id: item.id } }} asChild>
      <Pressable
        accessibilityHint="Opens Catch details"
        accessibilityLabel={`${item.title}, ${start}`}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <View style={styles.topRow}>
          <View style={[styles.iconTile, { backgroundColor: item.activity.color }]}>
            <Text style={styles.emoji}>{item.activity.emoji}</Text>
          </View>
          <View style={styles.heading}>
            <View style={styles.labelRow}>
              <Text style={styles.kind}>
                {item.kind === 'now' ? 'CATCH NOW' : item.activity.name.toUpperCase()}
              </Text>
              {item.locationType === 'private' ? (
                <Ionicons color={colors.forest} name="lock-closed" size={15} />
              ) : null}
            </View>
            <Text numberOfLines={1} style={styles.title}>{item.title}</Text>
            <Text style={styles.subtype}>
              {item.customActivityName ?? item.activity.name} · {item.intensity}
            </Text>
          </View>
        </View>

        <View style={styles.metaBlock}>
          <View style={styles.metaRow}>
            <Ionicons color={colors.forestSoft} name="time-outline" size={17} />
            <Text style={styles.metaText}>{start} · {item.durationMinutes} min</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons
              color={colors.forestSoft}
              name={item.locationType === 'private' ? 'shield-checkmark-outline' : 'location-outline'}
              size={17}
            />
            <Text numberOfLines={1} style={styles.metaText}>{catchLocationLabel(item)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.host}>
            <Avatar initials={initials || 'C'} size={30} />
            <Text style={styles.hostText}>Hosted by {item.hostFirstName}</Text>
          </View>
          <View style={styles.spots}>
            <Ionicons color={colors.forest} name="people-outline" size={16} />
            <Text style={styles.spotsText}>Up to {item.capacity}</Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 15,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    padding: spacing.md,
    ...shadows.card,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.995 }] },
  topRow: { flexDirection: 'row', gap: 13 },
  iconTile: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
  },
  emoji: { fontSize: 28 },
  heading: { flex: 1, gap: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kind: { color: colors.orangeDark, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  title: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  subtype: { color: colors.muted, fontSize: 12 },
  metaBlock: { gap: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 13,
  },
  host: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hostText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  spots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.paleGreen,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  spotsText: { color: colors.forest, fontSize: 12, fontWeight: '800' },
});
