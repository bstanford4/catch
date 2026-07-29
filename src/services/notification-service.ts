import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { notificationPath } from '@/services/notification-utils';

export type NotificationPreferences = {
  catchUpdates: boolean;
  joinRequests: boolean;
  messages: boolean;
  nearbyActivity: boolean;
  proposals: boolean;
  ratingReminders: boolean;
};

export type PushRegistrationState =
  | 'denied'
  | 'enabled'
  | 'missing_project'
  | 'unsupported';

export const defaultNotificationPreferences: NotificationPreferences = {
  catchUpdates: true,
  joinRequests: true,
  messages: true,
  nearbyActivity: true,
  proposals: true,
  ratingReminders: true,
};

const pushTokenStorageKey = (userId: string) => `catch:expo-push-token:${userId}`;

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function easProjectId() {
  return (
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    null
  );
}

function mapPreferences(row: {
  catch_updates: boolean;
  join_requests: boolean;
  messages: boolean;
  nearby_activity: boolean;
  proposals: boolean;
  rating_reminders: boolean;
}): NotificationPreferences {
  return {
    catchUpdates: row.catch_updates,
    joinRequests: row.join_requests,
    messages: row.messages,
    nearbyActivity: row.nearby_activity,
    proposals: row.proposals,
    ratingReminders: row.rating_reminders,
  };
}

function preferenceRow(userId: string, preferences: NotificationPreferences) {
  return {
    catch_updates: preferences.catchUpdates,
    join_requests: preferences.joinRequests,
    messages: preferences.messages,
    nearby_activity: preferences.nearbyActivity,
    proposals: preferences.proposals,
    rating_reminders: preferences.ratingReminders,
    user_id: userId,
  };
}

export async function loadNotificationPreferences(userId: string) {
  if (!supabase) {
    return {
      data: defaultNotificationPreferences,
      error: 'Supabase is not configured.',
    };
  }
  const { data, error } = await supabase
    .from('notification_preferences')
    .select(
      'proposals, join_requests, messages, catch_updates, nearby_activity, rating_reminders',
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { data: defaultNotificationPreferences, error: error.message };
  if (data) return { data: mapPreferences(data), error: null };

  const { error: insertError } = await supabase
    .from('notification_preferences')
    .insert(preferenceRow(userId, defaultNotificationPreferences));
  return {
    data: defaultNotificationPreferences,
    error: insertError?.message ?? null,
  };
}

export async function saveNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences,
) {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase
    .from('notification_preferences')
    .upsert(preferenceRow(userId, preferences));
  return { error: error?.message };
}

export async function loadPushRegistrationState(): Promise<{
  data: PushRegistrationState;
  error: string | null;
}> {
  if (Platform.OS === 'web') return { data: 'unsupported', error: null };
  if (!easProjectId()) return { data: 'missing_project', error: null };
  if (!supabase) return { data: 'denied', error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('has_active_push_token');
  return {
    data: data ? 'enabled' : 'denied',
    error: error?.message ?? null,
  };
}

async function configureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('catch-updates', {
    description: 'Plans, proposals, messages, and nearby Catch activity',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#F26B3A',
    name: 'Catch updates',
    vibrationPattern: [0, 180, 120, 180],
  });
}

async function acquireExpoPushToken(requestPermission: boolean) {
  if (Platform.OS === 'web') {
    return { token: null, state: 'unsupported' as const, error: null };
  }
  const projectId = easProjectId();
  if (!projectId) {
    return { token: null, state: 'missing_project' as const, error: null };
  }
  try {
    await configureAndroidChannel();
    const existing = await Notifications.getPermissionsAsync();
    const permission =
      existing.status === 'granted' || !requestPermission
        ? existing
        : await Notifications.requestPermissionsAsync();
    if (permission.status !== 'granted') {
      return { token: null, state: 'denied' as const, error: null };
    }
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    return { token, state: 'enabled' as const, error: null };
  } catch (error) {
    return {
      token: null,
      state: 'denied' as const,
      error: error instanceof Error ? error.message : 'Push registration failed.',
    };
  }
}

async function savePushToken(userId: string, token: string) {
  if (!supabase) return 'Supabase is not configured.';
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const { error } = await supabase.rpc('register_device_push_token', {
    requested_platform: platform,
    requested_token: token,
  });
  if (error) return error.message;
  await AsyncStorage.setItem(pushTokenStorageKey(userId), token);
  return null;
}

export async function enablePushNotifications(userId: string) {
  const result = await acquireExpoPushToken(true);
  if (!result.token) return { data: result.state, error: result.error };
  const error = await savePushToken(userId, result.token);
  return { data: error ? ('denied' as const) : result.state, error };
}

export async function syncGrantedPushToken(userId: string) {
  const result = await acquireExpoPushToken(false);
  if (!result.token) return { data: result.state, error: result.error };
  const error = await savePushToken(userId, result.token);
  return { data: error ? ('denied' as const) : result.state, error };
}

export async function disablePushNotifications(userId: string) {
  if (!supabase) {
    return { data: 'denied' as const, error: 'Supabase is not configured.' };
  }
  const token = await AsyncStorage.getItem(pushTokenStorageKey(userId));
  const { error } = token
    ? await supabase.rpc('revoke_device_push_token', { requested_token: token })
    : await supabase.rpc('revoke_my_device_push_tokens');
  if (!error) await AsyncStorage.removeItem(pushTokenStorageKey(userId));
  return { data: 'denied' as const, error: error?.message };
}

export async function revokeStoredPushToken(userId: string) {
  if (!supabase) return;
  const token = await AsyncStorage.getItem(pushTokenStorageKey(userId));
  if (!token) return;
  await supabase.rpc('revoke_device_push_token', { requested_token: token });
  await AsyncStorage.removeItem(pushTokenStorageKey(userId));
}

export function subscribeToNotificationResponses(onPath: (path: string) => void) {
  if (Platform.OS === 'web') return () => undefined;
  let active = true;
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (!active || !response) return;
    const path = notificationPath(response.notification.request.content.data);
    if (path) onPath(path);
  });
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const path = notificationPath(response.notification.request.content.data);
    if (path) onPath(path);
  });
  return () => {
    active = false;
    subscription.remove();
  };
}
