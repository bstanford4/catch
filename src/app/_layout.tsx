import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.cream },
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.cream },
          headerTintColor: colors.forest,
          headerTitleStyle: { color: colors.ink, fontWeight: '800' },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ title: 'Welcome back' }} />
        <Stack.Screen name="create/[mode]" options={{ title: 'Create a Catch' }} />
        <Stack.Screen name="catch/[id]" options={{ title: 'Catch details' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
