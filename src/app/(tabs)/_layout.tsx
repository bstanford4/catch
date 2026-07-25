import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';

const iconForRoute = {
  index: ['home-outline', 'home'],
  discover: ['compass-outline', 'compass'],
  create: ['add', 'add'],
  messages: ['chatbubble-ellipses-outline', 'chatbubble-ellipses'],
  profile: ['person-outline', 'person'],
} as const;

export default function TabLayout() {
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
