import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import {
  subscribeToNotificationResponses,
  syncGrantedPushToken,
} from '@/services/notification-service';

function NotificationCoordinator() {
  const router = useRouter();
  const { session } = useAuth();

  useEffect(() => {
    if (!session) return;
    void syncGrantedPushToken(session.user.id);
  }, [session]);

  useEffect(
    () => subscribeToNotificationResponses((path) => router.push(path as never)),
    [router],
  );

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationCoordinator />
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
          <Stack.Screen name="edit-profile" options={{ title: 'Edit profile' }} />
          <Stack.Screen name="availability" options={{ title: 'Availability' }} />
          <Stack.Screen name="notification-settings" options={{ title: 'Notifications' }} />
          <Stack.Screen name="my-catches" options={{ title: 'My Catches' }} />
          <Stack.Screen name="create/[mode]" options={{ title: 'Create a Catch' }} />
          <Stack.Screen name="catch/[id]" options={{ title: 'Catch details' }} />
          <Stack.Screen name="catch-memories/[id]" options={{ title: 'Catch Memories' }} />
          <Stack.Screen name="catch-highlights" options={{ title: 'Catch Highlights' }} />
          <Stack.Screen name="catch-requests/[id]" options={{ title: 'Join requests' }} />
          <Stack.Screen name="catch-mates" options={{ title: 'Catch Mates' }} />
          <Stack.Screen name="proposals" options={{ title: 'Catch proposals' }} />
          <Stack.Screen name="propose/[mateId]" options={{ title: 'Propose a Catch' }} />
          <Stack.Screen name="matches" options={{ title: 'Catches for you' }} />
          <Stack.Screen name="message/[type]/[id]" options={{ title: 'Conversation' }} />
          <Stack.Screen name="member/[id]" options={{ title: 'Participant profile' }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
