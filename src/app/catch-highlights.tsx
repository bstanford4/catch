import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { PublicCatchHighlightCard } from '@/components/public-catch-highlight-card';
import { Screen } from '@/components/ui/screen';
import { StatePanel } from '@/components/ui/state-panel';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import {
  type PublicCatchHighlight,
  listPublicCatchHighlights,
  reportPublicCatchPhoto,
} from '@/services/catch-highlight-service';

export default function CatchHighlightsScreen() {
  const { session } = useAuth();
  const [items, setItems] = useState<PublicCatchHighlight[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);
    const result = await listPublicCatchHighlights();
    setItems(result.data);
    setError(result.error ?? '');
    setIsLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function report(mediaId: string, category: 'privacy_or_permission' | 'inappropriate') {
    setError('');
    const result = await reportPublicCatchPhoto(mediaId, category);
    if (result.error) {
      setError(result.error);
      return;
    }
    await load();
    Alert.alert('Photo hidden', 'Thanks. The photo is no longer visible while it is reviewed.');
  }

  function chooseReportReason(mediaId: string) {
    Alert.alert(
      'Report this public photo?',
      'A report immediately hides the photo while it is reviewed.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          text: 'Privacy or permission',
          onPress: () => void report(mediaId, 'privacy_or_permission'),
        },
        {
          style: 'destructive',
          text: 'Inappropriate',
          onPress: () => void report(mediaId, 'inappropriate'),
        },
      ],
    );
  }

  return (
    <Screen>
      <Text style={styles.eyebrow}>GOOD TIMES, CONFIRMED</Text>
      <Text style={styles.title}>Catch Highlights</Text>
      <Text style={styles.subtitle}>
        A look back at public Catches shared by the people who were there.
      </Text>

      <View style={styles.safetyCard}>
        <Ionicons color={colors.forest} name="people-circle-outline" size={24} />
        <Text style={styles.safetyText}>
          Every photo starts private. Highlights appear only after the uploader confirms permission. Exact and private locations are never shown here.
        </Text>
      </View>

      {!session ? (
        <StatePanel
          body="Catch Highlights are visible only inside the signed-in Catch community."
          icon="lock-closed-outline"
          title="Sign in to look back"
        />
      ) : null}
      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.orange} />
          <Text style={styles.muted}>Gathering recent highlights…</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {session && !isLoading && !error && !items.length ? (
        <StatePanel
          body="Completed public Catches will appear after someone chooses to share a photo."
          icon="images-outline"
          title="The highlight reel is warming up"
        />
      ) : null}
      <View style={styles.list}>
        {items.map((item) => (
          <PublicCatchHighlightCard item={item} key={item.catchId} onReport={chooseReportReason} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { marginTop: spacing.sm, color: colors.orangeDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  subtitle: { marginTop: 4, color: colors.muted, fontSize: 14, lineHeight: 20 },
  safetyCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginTop: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.paleGreen, padding: spacing.md },
  safetyText: { flex: 1, color: colors.forest, fontSize: 12, lineHeight: 18 },
  loading: { alignItems: 'center', gap: 9, paddingVertical: spacing.xl },
  muted: { color: colors.muted, fontSize: 12 },
  error: { marginTop: spacing.md, color: colors.error, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  list: { gap: 15, marginTop: spacing.lg },
});
