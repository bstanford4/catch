import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/constants/theme';

type ChipProps = {
  label: string;
  selected?: boolean;
  icon?: ReactNode;
  onPress?: () => void;
};

export function Chip({ label, selected = false, icon, onPress }: ChipProps) {
  const content = (
    <>
      {icon}
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </>
  );

  if (!onPress) {
    return <View style={[styles.chip, selected && styles.selected]}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    backgroundColor: colors.paper,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  selected: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  pressed: {
    opacity: 0.82,
  },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  selectedLabel: {
    color: colors.white,
  },
});

