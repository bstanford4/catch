import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { StatePanel } from '@/components/ui/state-panel';
import { colors, radius, shadows, spacing } from '@/constants/theme';
import { saveCatchMate } from '@/services/catch-mate-service';
import { startDirectMessage } from '@/services/messaging-service';
import {
  type ParticipantProfile,
  blockParticipant,
  getParticipantProfile,
  reportParticipant,
} from '@/services/participant-profile-service';
import { memberInitials } from '@/utils/member-name';
import { buildScoutingSummary } from '@/services/post-catch-review-utils';

export default function ParticipantProfileScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<ParticipantProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportDetails, setReportDetails] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    void getParticipantProfile(id).then((result) => {
      if (!active) return;
      setProfile(result.data);
      setError(result.error ?? '');
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id]);

  async function message() {
    if (!profile) return;
    setIsSaving(true);
    setError('');
    const result = await startDirectMessage(profile.userId);
    setIsSaving(false);
    if (result.error || !result.data) {
      setError(result.error ?? 'The private conversation could not be opened.');
      return;
    }
    router.push({
      pathname: '/message/[type]/[id]',
      params: { id: result.data, type: 'direct' },
    });
  }

  async function saveMate() {
    if (!profile) return;
    setIsSaving(true);
    setError('');
    const result = await saveCatchMate(profile.userId);
    setIsSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setProfile({ ...profile, isCatchMate: true });
    setNotice(`${profile.firstName} is now a Catch Mate.`);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function submitReport() {
    if (!profile) return;
    setIsSaving(true);
    setError('');
    const result = await reportParticipant(profile.userId, reportDetails);
    setIsSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setReportDetails('');
    setShowReport(false);
    setNotice('Report received. It is visible only to the safety team.');
  }

  function confirmBlock() {
    if (!profile) return;
    Alert.alert(
      `Block ${profile.firstName}?`,
      'You will no longer see or message each other. Existing shared conversations will become unavailable.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          style: 'destructive',
          text: 'Block',
          onPress: () => {
            void (async () => {
              setIsSaving(true);
              setError('');
              const result = await blockParticipant(profile.userId);
              setIsSaving(false);
              if (result.error) {
                setError(result.error);
                return;
              }
              router.back();
            })();
          },
        },
      ],
    );
  }

  if (isLoading) {
    return (
      <Screen contentContainerStyle={styles.loading}>
        <ActivityIndicator color={colors.orange} size="large" />
        <Text style={styles.muted}>Loading participant profile...</Text>
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen>
        <StatePanel
          body={error || 'This profile is available only to connected Catch members.'}
          icon="lock-closed-outline"
          title="Profile unavailable"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <Avatar
          initials={memberInitials(profile.firstName)}
          photoUrl={profile.photoUrl}
          size={76}
          tone="gold"
        />
        <View style={styles.heroText}>
          <Text style={styles.eyebrow}>
            {profile.isCatchMate ? 'CATCH MATE' : 'SHARED CATCH'}
          </Text>
          <Text style={styles.title}>{profile.firstName}</Text>
          <View style={styles.areaRow}>
            <Ionicons color={colors.muted} name="location-outline" size={15} />
            <Text style={styles.area}>{profile.areaLabel}</Text>
          </View>
        </View>
      </View>

      <View style={styles.connection}>
        <Ionicons color={colors.forest} name="shield-checkmark" size={20} />
        <Text style={styles.connectionText}>
          {profile.catchesTogether
            ? `You are connected through ${profile.catchesTogether} ${
                profile.catchesTogether === 1 ? 'Catch' : 'Catches'
              }. `
            : 'You are connected as Catch Mates. '}
          Exact locations and contact information are never shown here.
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <View style={styles.actions}>
        <Button
          disabled={isSaving}
          icon="chatbubble-ellipses-outline"
          label={`Message ${profile.firstName}`}
          onPress={message}
        />
        {!profile.isCatchMate ? (
          <Button
            disabled={isSaving}
            icon="person-add-outline"
            label={isSaving ? 'Saving...' : 'Save as Catch Mate'}
            onPress={saveMate}
            variant="secondary"
          />
        ) : (
          <Button
            disabled={isSaving}
            icon="calendar-outline"
            label="Propose a Catch"
            onPress={() =>
              router.push({
                pathname: '/propose/[mateId]',
                params: { mateId: profile.userId, name: profile.firstName },
              })
            }
            variant="secondary"
          />
        )}
      </View>

      <LinearGradient colors={['#153B29', '#2C6547']} style={styles.catchCard}>
        <View style={styles.catchCardHeading}>
          <View>
            <Text style={styles.catchCardEyebrow}>CATCH CARD</Text>
            <Text style={styles.catchCardName}>{profile.firstName}’s scouting report</Text>
          </View>
          <Text style={styles.catchCardMark}>C</Text>
        </View>
        <View style={styles.catchStats}>
          <View style={styles.catchStat}>
            <Text style={styles.catchStatValue}>{profile.scoutingReport.completedCatchCount}</Text>
            <Text style={styles.catchStatLabel}>CATCHES</Text>
          </View>
          <View style={styles.catchStatDivider} />
          <View style={styles.catchStat}>
            <Text style={styles.catchStatValue}>
              {profile.scoutingReport.hasEnoughReviews
                ? `${profile.scoutingReport.reliablePercent}%`
                : 'NEW'}
            </Text>
            <Text style={styles.catchStatLabel}>RELIABLE</Text>
          </View>
          <View style={styles.catchStatDivider} />
          <View style={styles.catchStat}>
            <Text style={styles.catchStatValue}>
              {profile.scoutingReport.hasEnoughReviews
                ? `${profile.scoutingReport.wouldAgainPercent}%`
                : '—'}
            </Text>
            <Text style={styles.catchStatLabel}>AGAIN</Text>
          </View>
        </View>
        <View style={styles.scoutingCopy}>
          <Text style={styles.scoutingText}>
            {!profile.scoutingReport.isVisible
              ? 'This Catch Mate keeps their scouting report private.'
              : profile.scoutingReport.hasEnoughReviews
                ? buildScoutingSummary(
                    profile.scoutingReport.reviewerCount,
                    profile.scoutingReport.topTraits,
                  )
                : 'Scouting report building. Aggregates appear after reviews from a few different Catch Mates.'}
          </Text>
        </View>
      </LinearGradient>

      {profile.featuredFeedback.length ? (
        <ProfileSection icon="heart-outline" title="Featured Catch Mate notes">
          <Text style={styles.sectionIntro}>
            Quotes {profile.firstName} chose to share. Writers remain anonymous on the profile.
          </Text>
          {profile.featuredFeedback.map((feedback) => (
            <View key={feedback.feedbackId} style={styles.featuredQuoteCard}>
              <Text style={styles.featuredQuote}>“{feedback.sharedNote}”</Text>
              <Text style={styles.featuredQuoteMeta}>
                Featured anonymously by {profile.firstName}
              </Text>
            </View>
          ))}
        </ProfileSection>
      ) : null}

      <ProfileSection icon="person-outline" title="About">
        <Text style={styles.body}>
          {profile.bio?.trim() || 'No bio yet—just someone ready for a good Catch.'}
        </Text>
      </ProfileSection>

      <ProfileSection icon="football-outline" title="Activities">
        {profile.activities.length ? (
          <View style={styles.chips}>
            {profile.activities.map((activity) => (
              <View
                key={activity.slug}
                style={[styles.activityChip, { backgroundColor: activity.color }]}>
                <Text style={styles.activityEmoji}>{activity.emoji}</Text>
                <Text style={styles.activityName}>{activity.name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>No activities selected yet.</Text>
        )}
      </ProfileSection>

      <ProfileSection icon="time-outline" title="Usually available">
        {profile.availabilityLabels.length ? (
          <View style={styles.chips}>
            {profile.availabilityLabels.map((label) => (
              <View key={label} style={styles.availabilityChip}>
                <Text style={styles.availabilityText}>{label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>No recurring availability shared.</Text>
        )}
      </ProfileSection>

      <ProfileSection icon="bag-handle-outline" title="Gear Locker">
        <Text style={styles.sectionIntro}>
          Gear {profile.firstName} marked available to share. Tap an item for details.
        </Text>
        {profile.shareableEquipment.length ? (
          profile.shareableEquipment.map((item) => (
            <Pressable
              accessibilityHint="Opens this item in the gear locker"
              accessibilityLabel={`View ${item.name}`}
              key={item.id}
              onPress={() =>
                router.push({
                  pathname: '/member/[id]/equipment/[equipmentId]',
                  params: {
                    equipmentId: item.id,
                    id: profile.userId,
                    name: profile.firstName,
                  },
                })
              }
              style={({ pressed }) => [styles.equipmentCard, pressed && styles.equipmentCardPressed]}>
              {item.photoUrl ? (
                <Image
                  accessibilityLabel={`${item.name} equipment photo`}
                  contentFit="cover"
                  source={item.photoUrl}
                  style={styles.equipmentPhoto}
                  transition={180}
                />
              ) : (
                <View style={[styles.equipmentPhoto, styles.equipmentPlaceholder, { backgroundColor: item.activityColor }]}>
                  <Text style={styles.equipmentEmoji}>{item.activityEmoji}</Text>
                </View>
              )}
              <View style={styles.equipmentDetails}>
                <View style={styles.equipmentTitleRow}>
                  <Text style={styles.equipmentName}>{item.name}</Text>
                  <Ionicons color={colors.forest} name="chevron-forward" size={18} />
                </View>
                <Text style={styles.equipmentMeta}>
                  {item.activityName}
                  {item.condition ? ` · ${item.condition}` : ''}
                  {item.quantity > 1 ? ` · ${item.quantity} available` : ''}
                </Text>
                <Text style={styles.equipmentShared}>Marked available to share</Text>
              </View>
            </Pressable>
          ))
        ) : (
          <Text style={styles.muted}>No equipment marked as shareable.</Text>
        )}
      </ProfileSection>

      <View style={styles.safety}>
        <Text style={styles.safetyTitle}>Safety</Text>
        <Text style={styles.muted}>
          Reports are private. Blocking immediately removes mutual visibility and messaging.
        </Text>
        {showReport ? (
          <View style={styles.reportBox}>
            <TextInput
              accessibilityLabel={`Why are you reporting ${profile.firstName}?`}
              maxLength={2000}
              multiline
              onChangeText={setReportDetails}
              placeholder="Briefly explain what happened"
              placeholderTextColor={colors.muted}
              style={styles.reportInput}
              value={reportDetails}
            />
            <View style={styles.reportActions}>
              <Pressable onPress={() => setShowReport(false)} style={styles.safetyButton}>
                <Text style={styles.safetyText}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={isSaving}
                onPress={submitReport}
                style={[styles.safetyButton, styles.reportButton]}>
                <Text style={styles.reportText}>{isSaving ? 'Sending...' : 'Send report'}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.reportActions}>
            <Pressable onPress={() => setShowReport(true)} style={styles.safetyButton}>
              <Ionicons color={colors.error} name="flag-outline" size={16} />
              <Text style={styles.safetyDanger}>Report</Text>
            </Pressable>
            <Pressable disabled={isSaving} onPress={confirmBlock} style={styles.safetyButton}>
              <Ionicons color={colors.error} name="ban-outline" size={16} />
              <Text style={styles.safetyDanger}>Block</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Screen>
  );
}

function ProfileSection({
  children,
  icon,
  title,
}: {
  children: React.ReactNode;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Ionicons color={colors.forest} name={icon} size={18} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    padding: spacing.lg,
    ...shadows.card,
  },
  heroText: { flex: 1 },
  eyebrow: { color: colors.orangeDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '900', letterSpacing: -0.8 },
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  area: { color: colors.muted, fontSize: 13 },
  connection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.paleGreen,
    padding: 13,
  },
  connectionText: { flex: 1, color: colors.forest, fontSize: 11, lineHeight: 16 },
  actions: { gap: 9, marginTop: spacing.lg },
  catchCard: { overflow: 'hidden', marginTop: spacing.lg, borderRadius: 25, padding: 20 },
  catchCardHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  catchCardEyebrow: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  catchCardName: { marginTop: 3, color: colors.white, fontSize: 18, fontWeight: '800' },
  catchCardMark: { color: 'rgba(255,255,255,0.15)', fontSize: 45, fontWeight: '900', lineHeight: 46 },
  catchStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 22 },
  catchStat: { alignItems: 'center', gap: 3 },
  catchStatValue: { color: colors.white, fontSize: 23, fontWeight: '900' },
  catchStatLabel: { color: '#BDD1C3', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  catchStatDivider: { width: 1, height: 37, backgroundColor: 'rgba(255,255,255,0.17)' },
  scoutingCopy: { marginTop: 17, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.09)', padding: 11 },
  scoutingText: { color: '#E7F0E9', fontSize: 12, lineHeight: 18, fontStyle: 'italic' },
  featuredQuoteCard: { gap: 5, borderRadius: radius.md, backgroundColor: colors.paleGreen, padding: 12 },
  featuredQuote: { color: colors.forest, fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
  featuredQuoteMeta: { color: colors.forestSoft, fontSize: 8, fontWeight: '800', letterSpacing: 0.4 },
  section: {
    gap: 11,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    padding: spacing.md,
  },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  sectionIntro: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  body: { color: colors.ink, fontSize: 13, lineHeight: 19 },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  activityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  activityEmoji: { fontSize: 16 },
  activityName: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  availabilityChip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    backgroundColor: colors.cream,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  availabilityText: { color: colors.forest, fontSize: 10, fontWeight: '800' },
  equipmentCard: { overflow: 'hidden', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.cream },
  equipmentCardPressed: { opacity: 0.78, transform: [{ scale: 0.995 }] },
  equipmentPhoto: { width: '100%', height: 150 },
  equipmentPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  equipmentEmoji: { fontSize: 44 },
  equipmentDetails: { gap: 3, padding: 12 },
  equipmentTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  equipmentName: { flexShrink: 1, color: colors.ink, fontSize: 15, fontWeight: '900' },
  equipmentMeta: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  equipmentShared: { color: colors.forest, fontSize: 9, fontWeight: '800' },
  safety: {
    gap: 9,
    marginTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.lg,
  },
  safetyTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  reportActions: { flexDirection: 'row', gap: 9 },
  safetyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    backgroundColor: colors.paper,
  },
  safetyText: { color: colors.forest, fontSize: 12, fontWeight: '800' },
  safetyDanger: { color: colors.error, fontSize: 12, fontWeight: '800' },
  reportBox: { gap: 9 },
  reportInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    color: colors.ink,
    padding: 12,
    textAlignVertical: 'top',
  },
  reportButton: { borderColor: colors.error, backgroundColor: colors.error },
  reportText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  error: { marginTop: spacing.md, color: colors.error, fontSize: 12, textAlign: 'center' },
  notice: {
    marginTop: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.paleGreen,
    color: colors.forest,
    fontSize: 12,
    fontWeight: '700',
    padding: 11,
    textAlign: 'center',
  },
});
