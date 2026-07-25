import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

type SectionHeaderProps = {
  title: string;
  action?: string;
  onAction?: () => void;
};

export function SectionHeader({ title, action, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {action ? (
        <Pressable accessibilityRole="button" hitSlop={10} onPress={onAction}>
          <Text style={styles.action}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  action: {
    color: colors.orangeDark,
    fontSize: 14,
    fontWeight: '700',
  },
});

