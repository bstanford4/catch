import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { AuthProvider } from '@/providers/auth-provider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
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
          <Stack.Screen name="sign-in" options={{ title: 'Welcome to Catch' }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="equipment" options={{ title: 'Equipment' }} />
          <Stack.Screen name="availability" options={{ title: 'Availability' }} />
          <Stack.Screen name="my-catches" options={{ title: 'My Catches' }} />
          <Stack.Screen name="create/[mode]" options={{ title: 'Create a Catch' }} />
          <Stack.Screen name="catch/[id]" options={{ title: 'Catch details' }} />
          <Stack.Screen name="catch-requests/[id]" options={{ title: 'Join requests' }} />
          <Stack.Screen name="catch-mates" options={{ title: 'Catch Mates' }} />
          <Stack.Screen name="proposals" options={{ title: 'Catch proposals' }} />
          <Stack.Screen name="propose/[mateId]" options={{ title: 'Propose a Catch' }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
