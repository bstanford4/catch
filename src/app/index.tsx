import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

export default function Index() {
  const { isLoading, isProfileLoading, profile, session } = useAuth();

  if (isLoading || isProfileLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.orange} size="large" />
      </View>
    );
  }

  if (!session) return <Redirect href="/welcome" />;
  return <Redirect href={profile ? '/(tabs)' : '/onboarding'} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
});
