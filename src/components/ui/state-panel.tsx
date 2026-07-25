import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { colors, radius, spacing } from '@/constants/theme';

type StatePanelProps = {
  icon?: ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
};

export function StatePanel({
  icon = 'baseball-outline',
  title,
  body,
  action,
  onAction,
}: StatePanelProps) {
  return (
    <View style={styles.panel}>
      <View style={styles.icon}>
        <Ionicons color={colors.orange} name={icon} size={28} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {action && onAction ? <Button label={action} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    padding: spacing.xl,
  },
  icon: {
    width: 58,
    height: 58,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paleOrange,
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    maxWidth: 360,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 4,
  },
});

