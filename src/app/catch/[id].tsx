import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { StatePanel } from '@/components/ui/state-panel';
import { colors, radius, spacing } from '@/constants/theme';
import { getActivity, getCatch } from '@/data/demo';

export default function CatchDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = getCatch(id);
  const [requested, setRequested] = useState(false);

  if (!item) {
    return (
      <Screen>
        <StatePanel
          body="This catch may have expired or been canceled. There are plenty more on the board."
          icon="calendar-outline"
          title="That one got away"
        />
      </Screen>
    );
  }

  const activity = getActivity(item.activityId);
  const spots = item.capacity - item.participants;
  const host = item.host;

  function requestToJoin() {
    setRequested(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Request sent', `${host} will get a private join request. No address was shared.`);
  }

  return (
    <Screen>
      <LinearGradient
        colors={[activity.color, colors.paper]}
        style={styles.hero}>
        <View style={styles.icon}>
          <Text style={styles.emoji}>{activity.emoji}</Text>
        </View>
        <View style={styles.kind}>
          <Text style={styles.kindText}>{item.kind === 'now' ? 'CATCH NOW' : activity.name.toUpperCase()}</Text>
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtype}>{item.subtype}</Text>
      </LinearGradient>

      <View style={styles.hostRow}>
        <Avatar initials={item.hostInitials} size={52} tone="gold" />
        <View style={styles.hostText}>
          <Text style={styles.hostName}>{item.host} is hosting</Text>
          <View style={styles.verified}>
            <Ionicons color={colors.grass} name="checkmark-circle" size={15} />
            <Text style={styles.verifiedText}>98% reliable · 14 catches</Text>
          </View>
        </View>
        <Ionicons color={colors.muted} name="chevron-forward" size={20} />
      </View>

      <View style={styles.detailCard}>
        <Detail icon="time-outline" label="When" value={item.timeLabel} />
        <Detail
          icon="location-outline"
          label="Where"
          value={`${item.venue} · ${item.distanceMiles} mi`}
        />
        <Detail
          icon="people-outline"
          label="Crew"
          value={`${item.participants} going · ${spots} spots left`}
        />
        <Detail icon="speedometer-outline" label="Vibe" value={item.intensity} />
        <Detail icon="bag-handle-outline" label="Equipment" value={item.equipment} />
      </View>

      <View style={styles.about}>
        <Text style={styles.sectionTitle}>The plan</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>

      <View style={styles.privacy}>
        <Ionicons color={colors.forest} name="shield-checkmark" size={21} />
        <View style={styles.privacyText}>
          <Text style={styles.privacyTitle}>
            {item.isPublicVenue ? 'Public venue' : 'Private location protected'}
          </Text>
          <Text style={styles.privacyBody}>
            {item.isPublicVenue
              ? 'Meet in a public place and use the catch chat for final coordination.'
              : 'Exact details appear only after the host approves you.'}
          </Text>
        </View>
      </View>

      <Button
        disabled={requested}
        icon={requested ? 'checkmark-circle' : 'hand-left'}
        label={requested ? 'Request sent' : 'Request to join'}
        onPress={requestToJoin}
      />
      <Text style={styles.footerNote}>You can leave, block, or report at any time.</Text>
    </Screen>
  );
}

function Detail({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons color={colors.forest} name={icon} size={19} />
      </View>
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    marginTop: spacing.sm,
    borderRadius: 25,
    padding: 23,
  },
  icon: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  emoji: {
    fontSize: 34,
  },
  kind: {
    marginTop: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.paleOrange,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  kindText: {
    color: colors.orangeDark,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  title: {
    marginTop: 9,
    color: colors.ink,
    fontSize: 27,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.8,
  },
  subtype: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 13,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: spacing.lg,
  },
  hostText: {
    flex: 1,
    gap: 3,
  },
  hostName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    color: colors.muted,
    fontSize: 11,
  },
  detailCard: {
    gap: 15,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    padding: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.paleGreen,
  },
  detailText: {
    flex: 1,
    gap: 2,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  about: {
    marginTop: spacing.lg,
    gap: 6,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  privacy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.paleGreen,
    padding: 14,
  },
  privacyText: {
    flex: 1,
    gap: 2,
  },
  privacyTitle: {
    color: colors.forest,
    fontSize: 13,
    fontWeight: '800',
  },
  privacyBody: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  footerNote: {
    marginTop: 9,
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
  },
});
