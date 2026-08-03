import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadows, spacing } from '@/constants/theme';
import {
  type PublicCatchHighlight,
} from '@/services/catch-highlight-service';
import { describeCatchHighlight } from '@/services/catch-highlight-utils';

export function PublicCatchHighlightCard({
  item,
  onReport,
}: {
  item: PublicCatchHighlight;
  onReport?: (mediaId: string) => void;
}) {
  const description = describeCatchHighlight(item);
  return (
    <View accessibilityLabel={description} style={styles.card}>
      <View style={styles.heading}>
        <View style={[styles.activityIcon, { backgroundColor: item.activityColor }]}>
          <Text style={styles.emoji}>{item.activityEmoji}</Text>
        </View>
        <View style={styles.headingText}>
          <Text style={styles.eyebrow}>CATCH HIGHLIGHT</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.photoRow}
        horizontal
        showsHorizontalScrollIndicator={false}>
        {item.photos.map((photo) => (
          <View key={photo.id} style={styles.photoFrame}>
            <Image contentFit="cover" source={photo.url} style={styles.photo} transition={180} />
            {onReport ? (
              <Pressable
                accessibilityLabel="Report this public photo"
                onPress={() => onReport(photo.id)}
                style={({ pressed }) => [styles.reportButton, pressed && styles.pressed]}>
                <Ionicons color={colors.white} name="flag-outline" size={16} />
              </Pressable>
            ) : null}
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Ionicons color={colors.forest} name="shield-checkmark-outline" size={15} />
        <Text style={styles.footerText}>Shared with permission · signed-in Catch members</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    paddingVertical: spacing.md,
    ...shadows.card,
  },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingHorizontal: spacing.md },
  activityIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  emoji: { fontSize: 24 },
  headingText: { flex: 1, gap: 4 },
  eyebrow: { color: colors.orangeDark, fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  description: { color: colors.ink, fontSize: 14, fontWeight: '800', lineHeight: 20 },
  photoRow: { gap: 9, paddingHorizontal: spacing.md, paddingTop: 13 },
  photoFrame: { overflow: 'hidden', width: 255, height: 220, borderRadius: radius.md, backgroundColor: colors.ink },
  photo: { width: '100%', height: '100%' },
  reportButton: { position: 'absolute', top: 9, right: 9, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(23,33,27,0.72)' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingTop: 11 },
  footerText: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  pressed: { opacity: 0.75 },
});
