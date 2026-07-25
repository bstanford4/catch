import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

type AvatarProps = {
  initials: string;
  size?: number;
  tone?: 'green' | 'orange' | 'gold';
};

export function Avatar({ initials, size = 44, tone = 'green' }: AvatarProps) {
  const backgroundColor =
    tone === 'orange' ? colors.paleOrange : tone === 'gold' ? '#F6EAC7' : colors.paleGreen;

  return (
    <View
      accessibilityLabel={`${initials} profile placeholder`}
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor }]}>
      <Text style={[styles.initials, { fontSize: size * 0.32 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.forest,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});

