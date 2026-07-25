import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

const iconForRoute = {
  index: ['home-outline', 'home'],
  discover: ['compass-outline', 'compass'],
  create: ['add', 'add'],
  messages: ['chatbubble-ellipses-outline', 'chatbubble-ellipses'],
  profile: ['person-outline', 'person'],
} as const;

export default function TabLayout() {
  const { isProfileLoading, profile, session } = useAuth();

  if (session && isProfileLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.orange} size="large" />
      </View>
    );
  }

  if (session && !profile) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.forest,
        tabBarInactiveTintColor: '#8B918C',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: styles.tabBar,
        tabBarIcon: ({ color, focused, size }) => {
          const names = iconForRoute[route.name as keyof typeof iconForRoute];
          const name = names?.[focused ? 1 : 0] ?? 'ellipse-outline';
          if (route.name === 'create') {
            return (
              <View style={styles.createIcon}>
                <Ionicons color={colors.white} name="add" size={30} />
              </View>
            );
          }
          return <Ionicons color={color} name={name} size={size} />;
        },
      })}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
      <Tabs.Screen name="create" options={{ title: 'Create' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  tabBar: {
    position: 'absolute',
    height: 82,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.paper,
  },
  createIcon: {
    width: 50,
    height: 50,
    marginTop: -20,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.orange,
    borderWidth: 4,
    borderColor: colors.paper,
    shadowColor: colors.orangeDark,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
});
