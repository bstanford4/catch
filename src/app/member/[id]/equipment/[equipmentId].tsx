import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { StatePanel } from '@/components/ui/state-panel';
import { colors, radius, shadows, spacing } from '@/constants/theme';
import { startDirectMessage } from '@/services/messaging-service';
import {
  type ShareableEquipment,
  listParticipantShareableEquipment,
} from '@/services/participant-profile-service';

export default function ParticipantEquipmentDetailScreen() {
  const { equipmentId = '', id = '', name = 'your Catch Mate' } =
    useLocalSearchParams<{ equipmentId: string; id: string; name?: string }>();
  const router = useRouter();
  const [item, setItem] = useState<ShareableEquipment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMessaging, setIsMessaging] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void listParticipantShareableEquipment(id).then((result) => {
      if (!active) return;
      setItem(result.data.find((candidate) => candidate.id === equipmentId) ?? null);
      setError(result.error ?? '');
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [equipmentId, id]);

  async function askAboutItem() {
    setIsMessaging(true);
    setError('');
    const result = await startDirectMessage(id);
    setIsMessaging(false);
    if (result.error || !result.data) {
      setError(result.error ?? 'The private conversation could not be opened.');
      return;
    }
    router.push({
      pathname: '/message/[type]/[id]',
      params: { id: result.data, type: 'direct' },
    });
  }

  if (isLoading) {
    return (
      <Screen contentContainerStyle={styles.loading}>
        <ActivityIndicator color={colors.orange} size="large" />
        <Text style={styles.muted}>Opening the gear locker...</Text>
      </Screen>
    );
  }

  if (!item) {
    return (
      <Screen>
        <StatePanel
          body={
            error ||
            'This item is no longer shared, or this gear locker is not available to you.'
          }
          icon="bag-handle-outline"
          title="Equipment unavailable"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.hero}>
        {item.photoUrl ? (
          <Image
            accessibilityLabel={`${item.name} equipment photo`}
            contentFit="cover"
            source={item.photoUrl}
            style={styles.photo}
            transition={180}
          />
        ) : (
          <View style={[styles.photo, styles.placeholder, { backgroundColor: item.activityColor }]}>
            <Text style={styles.emoji}>{item.activityEmoji}</Text>
          </View>
        )}
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>{name.toUpperCase()}’S GEAR LOCKER</Text>
          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.activity}>{item.activityEmoji} {item.activityName}</Text>
        </View>
      </View>

      <View style={styles.availableBanner}>
        <Ionicons color={colors.forest} name="checkmark-circle" size={22} />
        <View style={styles.bannerCopy}>
          <Text style={styles.bannerTitle}>Available to share</Text>
          <Text style={styles.bannerText}>{name} marked this gear as available for a Catch.</Text>
        </View>
      </View>

      <View style={styles.details}>
        <Text style={styles.detailsTitle}>Gear details</Text>
        <DetailRow label="Activity" value={item.activityName} />
        <DetailRow label="Condition" value={item.condition || 'Not specified'} />
        <DetailRow label="Quantity" value={String(item.quantity)} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        disabled={isMessaging}
        icon="chatbubble-ellipses-outline"
        label={isMessaging ? 'Opening message...' : `Ask ${name} about this gear`}
        onPress={askAboutItem}
      />
      <Text style={styles.privacy}>
        Gear is visible only while its owner marks it available to share. Catch never reveals a
        private address here.
      </Text>
    </Screen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  hero: { overflow: 'hidden', marginTop: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.paper, ...shadows.card },
  photo: { width: '100%', height: 280 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 76 },
  heroCopy: { gap: 5, padding: spacing.lg },
  eyebrow: { color: colors.orangeDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '900', letterSpacing: -0.6 },
  activity: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  availableBanner: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: spacing.lg, borderRadius: radius.md, backgroundColor: colors.paleGreen, padding: spacing.md },
  bannerCopy: { flex: 1, gap: 2 },
  bannerTitle: { color: colors.forest, fontSize: 14, fontWeight: '900' },
  bannerText: { color: colors.forest, fontSize: 10, lineHeight: 15 },
  details: { gap: 2, marginVertical: spacing.lg, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: colors.paper, padding: spacing.md },
  detailsTitle: { marginBottom: 5, color: colors.ink, fontSize: 17, fontWeight: '900' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 15, borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 12 },
  detailLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  detailValue: { flex: 1, color: colors.ink, fontSize: 11, fontWeight: '800', textAlign: 'right' },
  muted: { color: colors.muted, fontSize: 11 },
  error: { marginBottom: spacing.md, color: colors.error, fontSize: 11, textAlign: 'center' },
  privacy: { marginTop: 11, color: colors.muted, fontSize: 9, lineHeight: 14, textAlign: 'center' },
});
