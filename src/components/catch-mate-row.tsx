import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { colors, radius, spacing } from '@/constants/theme';
import type { CatchMate } from '@/types/domain';

export function CatchMateRow({ mate, onPress }: { mate: CatchMate; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`${mate.name}, open to catch, ${mate.distanceMiles} miles away`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Avatar initials={mate.initials} size={50} tone="gold" />
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{mate.name}</Text>
          <View style={styles.reliability}>
            <Ionicons color={colors.grass} name="checkmark-circle" size={15} />
            <Text style={styles.reliabilityText}>{mate.reliability}%</Text>
          </View>
        </View>
        <Text style={styles.area}>
          {mate.area} · {mate.distanceMiles} mi
        </Text>
        <Text numberOfLines={1} style={styles.availability}>
          {mate.activities.join(' · ')} · {mate.availability}
        </Text>
      </View>
      <Ionicons color={colors.muted} name="chevron-forward" size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 82,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.82,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  reliability: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  reliabilityText: {
    color: colors.grass,
    fontSize: 11,
    fontWeight: '800',
  },
  area: {
    color: colors.muted,
    fontSize: 12,
  },
  availability: {
    color: colors.forest,
    fontSize: 12,
    fontWeight: '600',
  },
});

