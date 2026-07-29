import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Switch, Text, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import {
  defaultNotificationPreferences,
  disablePushNotifications,
  enablePushNotifications,
  loadNotificationPreferences,
  loadPushRegistrationState,
  type NotificationPreferences,
  type PushRegistrationState,
  saveNotificationPreferences,
} from '@/services/notification-service';

type PreferenceKey = keyof NotificationPreferences;

const preferenceRows: {
  detail: string;
  key: PreferenceKey;
  label: string;
}[] = [
  {
    key: 'proposals',
    label: 'Catch proposals',
    detail: 'New proposals, counteroffers, and decisions',
  },
  {
    key: 'joinRequests',
    label: 'Join requests',
    detail: 'Requests to join a Catch and host decisions',
  },
  {
    key: 'messages',
    label: 'Messages',
    detail: 'New messages in Catch conversations',
  },
  {
    key: 'catchUpdates',
    label: 'Catch updates',
    detail: 'Time, location, and cancellation changes',
  },
  {
    key: 'nearbyActivity',
    label: 'Nearby matches',
    detail: 'Catches matching your activities and availability',
  },
  {
    key: 'ratingReminders',
    label: 'Rating reminders',
    detail: 'A reminder after a completed Catch',
  },
];

function pushCopy(state: PushRegistrationState) {
  switch (state) {
    case 'enabled':
      return 'This device can receive Catch alerts when the app is closed.';
    case 'missing_project':
      return 'Ready after this project is linked to Expo and installed as a native build.';
    case 'unsupported':
      return 'Native push is managed in the installed iPhone or Android app, not the web preview.';
    default:
      return 'Turn this on to receive Catch alerts when the app is closed.';
  }
}

export default function NotificationSettingsScreen() {
  const { session } = useAuth();
  const [preferences, setPreferences] = useState(defaultNotificationPreferences);
  const [pushState, setPushState] = useState<PushRegistrationState>(
    Platform.OS === 'web' ? 'unsupported' : 'denied',
  );
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [isSavingPush, setIsSavingPush] = useState(false);
  const [savingPreference, setSavingPreference] = useState<PreferenceKey | null>(null);

  useEffect(() => {
    if (!session) return;
    let active = true;
    void Promise.all([
      loadNotificationPreferences(session.user.id),
      loadPushRegistrationState(),
    ]).then(([preferenceResult, pushResult]) => {
      if (!active) return;
      setPreferences(preferenceResult.data);
      setPushState(pushResult.data);
      setIsLoading(false);
      const error = preferenceResult.error ?? pushResult.error;
      if (error) Alert.alert('Could not load notifications', error);
    });
    return () => {
      active = false;
    };
  }, [session]);

  async function togglePush(value: boolean) {
    if (!session || pushState === 'unsupported' || pushState === 'missing_project') return;
    setIsSavingPush(true);
    const result = value
      ? await enablePushNotifications(session.user.id)
      : await disablePushNotifications(session.user.id);
    setIsSavingPush(false);
    if (result.error) {
      Alert.alert('Could not update push notifications', result.error);
      return;
    }
    if (value && result.data === 'denied') {
      Alert.alert(
        'Notifications are off',
        'Allow notifications for Catch in your phone settings, then try again.',
      );
      return;
    }
    setPushState(value ? result.data : 'denied');
  }

  async function togglePreference(key: PreferenceKey, value: boolean) {
    if (!session) return;
    const previous = preferences;
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    setSavingPreference(key);
    const { error } = await saveNotificationPreferences(session.user.id, next);
    setSavingPreference(null);
    if (error) {
      setPreferences(previous);
      Alert.alert('Could not save that setting', error);
    }
  }

  return (
    <Screen contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>YOUR ALERTS</Text>
      <Text style={styles.heading}>Stay in the loop, not in the app.</Text>
      <Text style={styles.intro}>
        Choose what Catch may notify you about. Your choices apply across your account.
      </Text>

      <View style={styles.pushCard}>
        <View style={styles.icon}>
          <Ionicons color={colors.forest} name="notifications-outline" size={22} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.label}>Native push notifications</Text>
          <Text style={styles.detail}>{pushCopy(pushState)}</Text>
        </View>
        <Switch
          accessibilityLabel="Native push notifications"
          disabled={
            isLoading ||
            isSavingPush ||
            pushState === 'unsupported' ||
            pushState === 'missing_project'
          }
          onValueChange={(value) => void togglePush(value)}
          thumbColor={colors.white}
          trackColor={{ false: colors.line, true: colors.grass }}
          value={pushState === 'enabled'}
        />
      </View>

      {pushState === 'missing_project' ? (
        <View style={styles.notice}>
          <Ionicons color={colors.forest} name="hammer-outline" size={18} />
          <Text style={styles.noticeText}>
            The app-side setup is complete. A one-time Expo/EAS link and native build are still
            required before this switch can request permission on a phone.
          </Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Notify me about</Text>
      <View style={styles.list}>
        {preferenceRows.map((row, index) => (
          <View
            key={row.key}
            style={[styles.preferenceRow, index === preferenceRows.length - 1 && styles.lastRow]}>
            <View style={styles.rowText}>
              <Text style={styles.label}>{row.label}</Text>
              <Text style={styles.detail}>{row.detail}</Text>
            </View>
            <Switch
              accessibilityLabel={row.label}
              disabled={isLoading || savingPreference === row.key || !session}
              onValueChange={(value) => void togglePreference(row.key, value)}
              thumbColor={colors.white}
              trackColor={{ false: colors.line, true: colors.grass }}
              value={preferences[row.key]}
            />
          </View>
        ))}
      </View>

      <View style={styles.privacyNote}>
        <Ionicons color={colors.forest} name="lock-closed" size={16} />
        <Text style={styles.privacyText}>
          Lock-screen alerts use brief, privacy-safe wording. Private addresses and message text
          are never shown in a push notification.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.lg,
  },
  eyebrow: {
    color: colors.orangeDark,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  heading: {
    maxWidth: 520,
    marginTop: spacing.sm,
    color: colors.ink,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.2,
    lineHeight: 38,
  },
  intro: {
    maxWidth: 560,
    marginTop: spacing.sm,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  pushCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.grass,
    borderRadius: radius.lg,
    backgroundColor: colors.paleGreen,
    padding: spacing.md,
  },
  icon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.white,
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  label: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  detail: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.paleOrange,
    padding: spacing.md,
  },
  noticeText: {
    flex: 1,
    color: colors.forest,
    fontSize: 12,
    lineHeight: 18,
  },
  sectionTitle: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    color: colors.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  list: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.md,
  },
  preferenceRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginTop: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.paleGreen,
    padding: spacing.md,
  },
  privacyText: {
    flex: 1,
    color: colors.forest,
    fontSize: 12,
    lineHeight: 18,
  },
});
