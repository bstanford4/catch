import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { StatePanel } from '@/components/ui/state-panel';
import { colors, radius, shadows, spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import {
  type AttendanceValue,
  type CatchAttendanceMember,
  listCatchAttendance,
  saveCatchAttendance,
} from '@/services/attendance-service';

export default function CatchAttendanceScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [members, setMembers] = useState<CatchAttendanceMember[]>([]);
  const [savingId, setSavingId] = useState('');
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    const result = await listCatchAttendance(id);
    setMembers(result.data);
    setError(result.error ?? '');
    setIsLoading(false);
  }, [id, session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const self = useMemo(() => members.find((member) => member.isSelf) ?? null, [members]);
  const others = useMemo(() => members.filter((member) => !member.isSelf), [members]);

  async function choose(member: CatchAttendanceMember, value: AttendanceValue) {
    setSavingId(member.subjectId);
    setError('');
    const result = await saveCatchAttendance(id, member.subjectId, value);
    setSavingId('');
    if (result.error) {
      setError(result.error);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await load();
  }

  if (!session) {
    return (
      <Screen>
        <StatePanel body="Sign in to confirm attendance for your Catch." icon="person-outline" title="Sign in first" />
      </Screen>
    );
  }
  if (isLoading) {
    return (
      <Screen contentContainerStyle={styles.loading}>
        <ActivityIndicator color={colors.orange} size="large" />
        <Text style={styles.muted}>Opening the attendance check...</Text>
      </Screen>
    );
  }
  if (!self) {
    return (
      <Screen>
        <StatePanel body={error || 'This attendance check is unavailable.'} icon="people-outline" title="Attendance unavailable" />
      </Screen>
    );
  }

  const selfAttended = self.myConfirmation === 'attended';
  return (
    <Screen>
      <Text style={styles.eyebrow}>POST-CATCH CHECK-IN</Text>
      <Text style={styles.title}>Who made the Catch?</Text>
      <Text style={styles.subtitle}>
        {self.catchTitle} · {formatDate(self.startsAt)}
      </Text>

      <View style={styles.privacyCard}>
        <Ionicons color={colors.forest} name="shield-checkmark" size={23} />
        <Text style={styles.privacyText}>
          Attendance answers are private. One person reporting a no-show never changes another member’s public reputation.
        </Text>
      </View>

      <View style={styles.selfCard}>
        <Text style={styles.sectionEyebrow}>START WITH YOURSELF</Text>
        <Text style={styles.sectionTitle}>Were you there?</Text>
        <Text style={styles.helper}>Confirm this before reviewing anyone else.</Text>
        <AttendanceChoices
          busy={savingId === self.subjectId}
          onChoose={(value) => choose(self, value)}
          selected={self.myConfirmation}
          yesLabel="Yes, I attended"
        />
      </View>

      {self.myConfirmation === 'no_show' ? (
        <View style={styles.notice}>
          <Ionicons color={colors.orangeDark} name="information-circle-outline" size={21} />
          <Text style={styles.noticeText}>
            Thanks for confirming. You will not be asked to rate people from a Catch you did not attend. You can change this answer if needed.
          </Text>
        </View>
      ) : null}

      {selfAttended && others.length ? (
        <View style={styles.crewSection}>
          <Text style={styles.sectionEyebrow}>THE REST OF THE CREW</Text>
          <Text style={styles.sectionTitle}>Did they attend?</Text>
          <Text style={styles.helper}>You can return and update these answers later.</Text>
          {others.map((member) => (
            <View key={member.subjectId} style={styles.memberCard}>
              <View style={styles.memberHeading}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{initials(member.subjectName)}</Text></View>
                <View style={styles.memberCopy}>
                  <Text style={styles.memberName}>{member.subjectName}</Text>
                  <Text style={styles.memberStatus}>{statusLabel(member.resolvedStatus)}</Text>
                </View>
              </View>
              <AttendanceChoices
                busy={savingId === member.subjectId}
                onChoose={(value) => choose(member, value)}
                selected={member.myConfirmation}
                yesLabel="Attended"
              />
            </View>
          ))}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {selfAttended ? (
        <Button
          icon="clipboard-outline"
          label="Continue to crew reviews"
          onPress={() => router.push(`/post-catch-review/${id}` as never)}
        />
      ) : null}
      <Button
        icon="images-outline"
        label="Open Catch Memories"
        onPress={() => router.push(`/catch-memories/${id}` as never)}
        variant="secondary"
      />
    </Screen>
  );
}

function AttendanceChoices({
  busy,
  onChoose,
  selected,
  yesLabel,
}: {
  busy: boolean;
  onChoose: (value: AttendanceValue) => void;
  selected: AttendanceValue | null;
  yesLabel: string;
}) {
  return (
    <View style={styles.choices}>
      <Pressable disabled={busy} onPress={() => onChoose('attended')} style={[styles.choice, selected === 'attended' && styles.choiceSelected]}>
        <Ionicons color={selected === 'attended' ? colors.white : colors.forest} name="checkmark-circle-outline" size={20} />
        <Text style={[styles.choiceText, selected === 'attended' && styles.choiceTextSelected]}>{yesLabel}</Text>
      </Pressable>
      <Pressable disabled={busy} onPress={() => onChoose('no_show')} style={[styles.choice, selected === 'no_show' && styles.choiceNoShow]}>
        <Ionicons color={selected === 'no_show' ? colors.white : colors.muted} name="close-circle-outline" size={20} />
        <Text style={[styles.choiceText, selected === 'no_show' && styles.choiceTextSelected]}>Didn’t attend</Text>
      </Pressable>
    </View>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
function initials(value: string) {
  return value.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}
function statusLabel(value: CatchAttendanceMember['resolvedStatus']) {
  if (value === 'attended') return 'Attendance confirmed';
  if (value === 'no_show') return 'Did not attend';
  if (value === 'disputed') return 'Attendance needs confirmation';
  return 'Awaiting their confirmation';
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: 10, paddingVertical: spacing.xxl },
  eyebrow: { marginTop: spacing.sm, color: colors.orangeDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 33, fontWeight: '900', letterSpacing: -1 },
  subtitle: { marginTop: 4, color: colors.muted, fontSize: 12, lineHeight: 18 },
  privacyCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.paleGreen, padding: spacing.md },
  privacyText: { flex: 1, color: colors.forest, fontSize: 11, lineHeight: 17 },
  selfCard: { gap: 9, marginTop: spacing.lg, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: colors.paper, padding: spacing.md, ...shadows.card },
  sectionEyebrow: { color: colors.orangeDark, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  helper: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  choices: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.cream, paddingHorizontal: 8 },
  choiceSelected: { borderColor: colors.forest, backgroundColor: colors.forest },
  choiceNoShow: { borderColor: colors.muted, backgroundColor: colors.muted },
  choiceText: { color: colors.ink, fontSize: 10, fontWeight: '900', textAlign: 'center' },
  choiceTextSelected: { color: colors.white },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: spacing.md, borderRadius: radius.md, backgroundColor: colors.paleOrange, padding: 12 },
  noticeText: { flex: 1, color: colors.orangeDark, fontSize: 10, lineHeight: 15 },
  crewSection: { gap: 9, marginTop: spacing.xl },
  memberCard: { gap: 10, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: colors.paper, padding: spacing.md },
  memberHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.paleOrange },
  avatarText: { color: colors.orangeDark, fontSize: 13, fontWeight: '900' },
  memberCopy: { flex: 1, gap: 2 },
  memberName: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  memberStatus: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 11 },
  error: { color: colors.error, fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
