import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { StatePanel } from '@/components/ui/state-panel';
import { colors, radius, shadows, spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import {
  type CatchMateInvite,
  type DirectCatchProposal,
  type SavedCatchMate,
  createCatchMateInvite,
  listCatchMates,
  listDirectCatchProposals,
  redeemCatchMateInvite,
  removeCatchMate,
} from '@/services/catch-mate-service';
import { startDirectMessage } from '@/services/messaging-service';

export default function CatchMatesScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [mates, setMates] = useState<SavedCatchMate[]>([]);
  const [invite, setInvite] = useState<CatchMateInvite | null>(null);
  const [friendCode, setFriendCode] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [isSaving, setIsSaving] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!session) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const [matesResult, proposalsResult] = await Promise.all([
      listCatchMates(),
      listDirectCatchProposals(),
    ]);
    setMates(matesResult.data);
    setPendingCount(
      proposalsResult.data.filter(
        (proposal: DirectCatchProposal) =>
          proposal.direction === 'received' && proposal.status === 'pending',
      ).length,
    );
    setError(matesResult.error ?? proposalsResult.error ?? '');
    setIsLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function generateInvite() {
    setIsSaving(true);
    setError('');
    setNotice('');
    const result = await createCatchMateInvite();
    setIsSaving(false);
    if (result.error || !result.data) {
      setError(result.error ?? 'Friend code could not be created.');
      return;
    }
    setInvite(result.data);
  }

  async function redeemInvite() {
    if (friendCode.trim().length !== 10) {
      setError('Enter the 10-character friend code.');
      return;
    }
    setIsSaving(true);
    setError('');
    setNotice('');
    const result = await redeemCatchMateInvite(friendCode);
    setIsSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setFriendCode('');
    setNotice('Friend added to Catch Mates.');
    await load();
  }

  async function remove(mate: SavedCatchMate) {
    if (confirmRemoveId !== mate.id) {
      setConfirmRemoveId(mate.id);
      return;
    }
    setIsSaving(true);
    const result = await removeCatchMate(mate.id);
    setIsSaving(false);
    setConfirmRemoveId('');
    if (result.error) {
      setError(result.error);
      return;
    }
    setMates((current) => current.filter((item) => item.id !== mate.id));
  }

  async function message(mate: SavedCatchMate) {
    setIsSaving(true);
    setError('');
    const result = await startDirectMessage(mate.id);
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

  return (
    <Screen>
      <View style={styles.headingRow}>
        <View style={styles.headingText}>
          <Text style={styles.eyebrow}>YOUR PEOPLE</Text>
          <Text style={styles.title}>Catch Mates</Text>
          <Text style={styles.subtitle}>Keep the good ones close and make the next plan easy.</Text>
        </View>
        <Pressable
          accessibilityLabel={`Open proposals${pendingCount ? `, ${pendingCount} pending` : ''}`}
          onPress={() => router.push('/proposals')}
          style={styles.inboxButton}>
          <Ionicons color={colors.forest} name="mail-outline" size={22} />
          {pendingCount ? (
            <View style={styles.badge}><Text style={styles.badgeText}>{pendingCount}</Text></View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.friendCard}>
        <View style={styles.friendHeading}>
          <Ionicons color={colors.forest} name="link-outline" size={21} />
          <View style={styles.headingText}>
            <Text style={styles.friendTitle}>Add someone you already know</Text>
            <Text style={styles.friendBody}>
              Use a private, single-use code. Catch never exposes a searchable email directory.
            </Text>
          </View>
        </View>
        {invite ? (
          <View style={styles.codeBox}>
            <Text selectable style={styles.code}>{invite.code}</Text>
            <Text style={styles.codeHelp}>
              Share this code privately. It expires{' '}
              {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
                new Date(invite.expiresAt),
              )}.
            </Text>
          </View>
        ) : (
          <Button
            disabled={isSaving}
            icon="key-outline"
            label={isSaving ? 'Creating code...' : 'Create my friend code'}
            onPress={generateInvite}
            variant="secondary"
          />
        )}
        <View style={styles.redeemRow}>
          <TextInput
            autoCapitalize="characters"
            accessibilityLabel="Friend code"
            maxLength={10}
            onChangeText={(value) => setFriendCode(value.replace(/[^a-z0-9]/gi, '').toUpperCase())}
            placeholder="ENTER CODE"
            placeholderTextColor={colors.muted}
            style={styles.codeInput}
            value={friendCode}
          />
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={redeemInvite}
            style={({ pressed }) => [styles.addCodeButton, pressed && styles.pressed]}>
            <Text style={styles.addCodeText}>Add</Text>
          </Pressable>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.orange} />
          <Text style={styles.muted}>Loading your Catch Mates...</Text>
        </View>
      ) : null}
      {!isLoading && session && mates.length === 0 ? (
        <StatePanel
          body="Use a friend code now, or save someone after you share an approved Catch."
          icon="people-outline"
          title="Your bench is open"
        />
      ) : null}
      {!isLoading && !session ? (
        <StatePanel
          body="Create an account to save Catch Mates and send real proposals."
          icon="person-outline"
          title="Sign in first"
        />
      ) : null}

      {mates.length ? (
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Saved mates</Text>
            <Text style={styles.count}>{mates.length}</Text>
          </View>
          {mates.map((mate) => (
            <View key={mate.id} style={styles.mateCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{mate.firstName.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={styles.mateBody}>
                <Text style={styles.mateName}>{mate.firstName}</Text>
                <Text style={styles.muted}>{mate.areaLabel}</Text>
                <Text style={styles.source}>
                  {mate.source === 'friend_code' ? 'KNOWN FRIEND' : 'SHARED CATCH'}
                </Text>
              </View>
              <View style={styles.mateActions}>
                <Pressable
                  accessibilityLabel={`Message ${mate.firstName}`}
                  disabled={isSaving}
                  onPress={() => message(mate)}
                  style={({ pressed }) => [styles.messageButton, pressed && styles.pressed]}>
                  <Ionicons color={colors.forest} name="chatbubble-outline" size={16} />
                  <Text style={styles.messageText}>Message</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Propose a Catch with ${mate.firstName}`}
                  onPress={() =>
                    router.push({
                      pathname: '/propose/[mateId]',
                      params: { mateId: mate.id, name: mate.firstName },
                    })
                  }
                  style={({ pressed }) => [styles.proposeButton, pressed && styles.pressed]}>
                  <Ionicons color={colors.white} name="paper-plane-outline" size={17} />
                  <Text style={styles.proposeText}>Propose</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Remove ${mate.firstName} from Catch Mates`}
                  onPress={() => remove(mate)}
                  style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}>
                  <Text style={styles.removeText}>
                    {confirmRemoveId === mate.id ? 'Confirm' : 'Remove'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginTop: spacing.sm },
  headingText: { flex: 1 },
  eyebrow: { color: colors.orangeDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 31, fontWeight: '900' },
  subtitle: { marginTop: 4, color: colors.muted, fontSize: 13, lineHeight: 19 },
  inboxButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: colors.paper,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 21,
    height: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: colors.orange,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  friendCard: {
    gap: 12,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    padding: spacing.md,
    ...shadows.card,
  },
  friendHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  friendTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  friendBody: { marginTop: 3, color: colors.muted, fontSize: 11, lineHeight: 16 },
  codeBox: { borderRadius: radius.md, backgroundColor: colors.paleGreen, padding: 14 },
  code: { color: colors.forest, fontSize: 25, fontWeight: '900', letterSpacing: 3, textAlign: 'center' },
  codeHelp: { marginTop: 5, color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center' },
  redeemRow: { flexDirection: 'row', gap: 9 },
  codeInput: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.2,
    paddingHorizontal: 13,
  },
  addCodeButton: {
    minWidth: 74,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.forest,
  },
  addCodeText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  loading: { alignItems: 'center', gap: 9, marginTop: spacing.xl },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  error: { marginTop: spacing.md, color: colors.error, fontSize: 13, textAlign: 'center' },
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
  section: { gap: 11, marginTop: spacing.xl },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  count: {
    borderRadius: radius.pill,
    backgroundColor: colors.paleGreen,
    color: colors.forest,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    padding: 13,
  },
  avatar: {
    width: 49,
    height: 49,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.paleOrange,
  },
  avatarText: { color: colors.forest, fontSize: 14, fontWeight: '900' },
  mateBody: { flex: 1, gap: 2 },
  mateName: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  source: { marginTop: 2, color: colors.orangeDark, fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  mateActions: { alignItems: 'stretch', gap: 3 },
  proposeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: colors.orange,
    paddingHorizontal: 10,
  },
  proposeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 36,
    borderWidth: 1,
    borderColor: colors.forest,
    borderRadius: 12,
    backgroundColor: colors.paper,
    paddingHorizontal: 9,
  },
  messageText: { color: colors.forest, fontSize: 10, fontWeight: '800' },
  removeButton: { alignItems: 'center', paddingVertical: 6 },
  removeText: { color: colors.error, fontSize: 9, fontWeight: '800' },
  pressed: { opacity: 0.75 },
});
