import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { StatePanel } from '@/components/ui/state-panel';
import { colors, radius, shadows, spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import {
  listPostCatchReview,
  type PostCatchReviewTarget,
  savePostCatchReview,
} from '@/services/post-catch-review-service';
import {
  postCatchTraits,
  type PostCatchTrait,
} from '@/services/post-catch-review-utils';

const scoreLabels = ['Rough', 'Not great', 'Good', 'Very good', 'Great'];

export default function PostCatchReviewScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [targets, setTargets] = useState<PostCatchReviewTarget[]>([]);
  const [activeId, setActiveId] = useState('');
  const [score, setScore] = useState<number | null>(null);
  const [wouldCatchAgain, setWouldCatchAgain] = useState<boolean | null>(null);
  const [traits, setTraits] = useState<PostCatchTrait[]>([]);
  const [privateNote, setPrivateNote] = useState('');
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    if (!session) return;
    let active = true;
    void listPostCatchReview(id).then((result) => {
      if (!active) return;
      setTargets(result.data);
      const firstTarget = result.data.find((target) => !target.reviewedAt) ?? result.data[0];
      setActiveId(firstTarget?.subjectId ?? '');
      setScore(firstTarget?.score ?? null);
      setWouldCatchAgain(firstTarget?.wouldCatchAgain ?? null);
      setTraits(firstTarget?.traits ?? []);
      setPrivateNote(firstTarget?.privateNote ?? '');
      setError(result.error ?? '');
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id, session]);

  const current = useMemo(
    () => targets.find((target) => target.subjectId === activeId) ?? null,
    [activeId, targets],
  );

  function toggleTrait(value: PostCatchTrait) {
    setTraits((selected) =>
      selected.includes(value)
        ? selected.filter((trait) => trait !== value)
        : [...selected, value],
    );
  }

  async function save() {
    if (!current) return;
    setIsSaving(true);
    setError('');
    setSavedMessage('');
    const result = await savePostCatchReview({
      catchId: id,
      privateNote,
      score,
      subjectId: current.subjectId,
      traits,
      wouldCatchAgain,
    });
    setIsSaving(false);
    if (result.error) {
      setError(
        result.error.includes('list_post_catch_review') || result.error.includes('upsert_post_catch_review')
          ? 'Post-Catch reviews are not ready yet. Apply the post-Catch review migration, then try again.'
          : result.error,
      );
      return;
    }

    const reviewedAt = new Date().toISOString();
    const updated = targets.map((target) =>
      target.subjectId === current.subjectId
        ? { ...target, privateNote, reviewedAt, score, traits, wouldCatchAgain }
        : target,
    );
    setTargets(updated);
    setSavedMessage(`Review saved for ${current.subjectName}. You can update it anytime.`);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const next = updated.find((target) => !target.reviewedAt);
    if (next) {
      setActiveId(next.subjectId);
      setScore(next.score);
      setWouldCatchAgain(next.wouldCatchAgain);
      setTraits(next.traits);
      setPrivateNote(next.privateNote);
      setSavedMessage('');
    }
  }

  if (!session) {
    return (
      <Screen>
        <StatePanel body="Sign in to review people from a completed Catch." icon="person-outline" title="Sign in first" />
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen contentContainerStyle={styles.loading}>
        <ActivityIndicator color={colors.orange} size="large" />
        <Text style={styles.muted}>Opening your post-Catch check-in...</Text>
      </Screen>
    );
  }

  if (!targets.length) {
    return (
      <Screen>
        <Text style={styles.eyebrow}>POST-CATCH CHECK-IN</Text>
        <Text style={styles.title}>How did it go?</Text>
        {error ? (
          <StatePanel body={error} icon="alert-circle-outline" title="Review unavailable" />
        ) : (
          <StatePanel
            body="There is nobody else confirmed in this Catch yet. For a retroactive Catch, your Catch Mate must first confirm they were there."
            icon="people-outline"
            title="Waiting for the crew"
          />
        )}
        <Button
          icon="images-outline"
          label="Open Catch Memories"
          onPress={() => router.push(`/catch-memories/${id}` as never)}
          variant="secondary"
        />
      </Screen>
    );
  }

  const reviewedCount = targets.filter((target) => target.reviewedAt).length;

  return (
    <Screen>
      <Text style={styles.eyebrow}>POST-CATCH CHECK-IN</Text>
      <Text style={styles.title}>How did it go?</Text>
      <Text style={styles.subtitle}>
        {targets[0].catchTitle} · {formatDate(targets[0].startsAt)}
      </Text>

      <View style={styles.infoCard}>
        <Ionicons color={colors.forest} name="refresh-circle-outline" size={24} />
        <Text style={styles.infoText}>
          This is the same form for every completed Catch. Your answers are private, and you can return from Catch History to update them anytime.
        </Text>
      </View>

      <View style={styles.progressHeading}>
        <Text style={styles.sectionTitle}>Catch crew</Text>
        <Text style={styles.progress}>{reviewedCount} of {targets.length} reviewed</Text>
      </View>
      <View style={styles.peopleRow}>
        {targets.map((target) => {
          const selected = target.subjectId === activeId;
          return (
            <Pressable
              accessibilityLabel={`${target.subjectName}${target.reviewedAt ? ', review saved' : ', needs review'}`}
              key={target.subjectId}
              onPress={() => {
                setActiveId(target.subjectId);
                setScore(target.score);
                setWouldCatchAgain(target.wouldCatchAgain);
                setTraits(target.traits);
                setPrivateNote(target.privateNote);
                setError('');
                setSavedMessage('');
              }}
              style={[styles.personChip, selected && styles.personChipSelected]}>
              <Ionicons
                color={selected ? colors.white : target.reviewedAt ? colors.grass : colors.muted}
                name={target.reviewedAt ? 'checkmark-circle' : 'person-circle-outline'}
                size={20}
              />
              <Text style={[styles.personChipText, selected && styles.personChipTextSelected]}>{target.subjectName}</Text>
            </Pressable>
          );
        })}
      </View>

      {current ? (
        <View style={styles.formCard}>
          <View style={styles.formHeading}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(current.subjectName)}</Text>
            </View>
            <View style={styles.formHeadingText}>
              <Text style={styles.formTitle}>{current.subjectName}</Text>
              <Text style={styles.muted}>{current.reviewedAt ? 'Update your saved review' : 'Complete their post-Catch review'}</Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Overall experience</Text>
          <Text style={styles.helper}>How was it sharing this Catch with them?</Text>
          <View style={styles.scoreRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                accessibilityLabel={`${value} out of 5, ${scoreLabels[value - 1]}`}
                key={value}
                onPress={() => setScore(value)}
                style={[styles.scoreButton, score === value && styles.scoreButtonSelected]}>
                <Ionicons
                  color={score === value ? colors.gold : colors.muted}
                  name={score !== null && value <= score ? 'star' : 'star-outline'}
                  size={22}
                />
                <Text style={[styles.scoreNumber, score === value && styles.scoreNumberSelected]}>{value}</Text>
              </Pressable>
            ))}
          </View>
          {score ? <Text style={styles.scoreLabel}>{scoreLabels[score - 1]}</Text> : null}

          <Text style={styles.fieldLabel}>Would you Catch with {firstName(current.subjectName)} again?</Text>
          <View style={styles.binaryRow}>
            <ChoiceButton label="Yes" selected={wouldCatchAgain === true} onPress={() => setWouldCatchAgain(true)} />
            <ChoiceButton label="No" selected={wouldCatchAgain === false} onPress={() => setWouldCatchAgain(false)} />
          </View>

          <Text style={styles.fieldLabel}>What stood out? <Text style={styles.optional}>(optional)</Text></Text>
          <View style={styles.traitRow}>
            {postCatchTraits.map((trait) => (
              <Pressable
                key={trait.value}
                onPress={() => toggleTrait(trait.value)}
                style={[styles.traitChip, traits.includes(trait.value) && styles.traitChipSelected]}>
                <Text style={[styles.traitText, traits.includes(trait.value) && styles.traitTextSelected]}>{trait.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Private note <Text style={styles.optional}>(optional)</Text></Text>
          <Text style={styles.helper}>For your own context. This is never added to their public scouting report.</Text>
          <TextInput
            accessibilityLabel={`Private note about ${current.subjectName}`}
            maxLength={1000}
            multiline
            onChangeText={setPrivateNote}
            placeholder="Anything you want to remember"
            placeholderTextColor={colors.muted}
            style={styles.noteInput}
            value={privateNote}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {savedMessage ? <Text style={styles.success}>{savedMessage}</Text> : null}
          <Button
            disabled={isSaving}
            icon="checkmark-circle-outline"
            label={isSaving ? 'Saving...' : current.reviewedAt ? 'Update review' : 'Save review'}
            onPress={save}
          />
        </View>
      ) : null}

      <Button
        icon="images-outline"
        label="Add photos or videos"
        onPress={() => router.push(`/catch-memories/${id}` as never)}
        variant="secondary"
      />
    </Screen>
  );
}

function ChoiceButton({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.choiceButton, selected && styles.choiceButtonSelected]}>
      <Ionicons color={selected ? colors.white : colors.forest} name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={21} />
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function firstName(name: string) {
  return name.split(/\s+/)[0] || 'them';
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: 10, paddingVertical: spacing.xxl },
  eyebrow: { marginTop: spacing.sm, color: colors.orangeDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 34, fontWeight: '900', letterSpacing: -1.1 },
  subtitle: { marginTop: 4, color: colors.muted, fontSize: 13, lineHeight: 19 },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.paleGreen, padding: spacing.md },
  infoText: { flex: 1, color: colors.forest, fontSize: 11, lineHeight: 17 },
  progressHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  progress: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  peopleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  personChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 42, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, backgroundColor: colors.paper, paddingHorizontal: 12 },
  personChipSelected: { borderColor: colors.forest, backgroundColor: colors.forest },
  personChipText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  personChipTextSelected: { color: colors.white },
  formCard: { gap: 12, marginTop: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: colors.paper, padding: spacing.md, ...shadows.card },
  formHeading: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  formHeadingText: { flex: 1, gap: 2 },
  avatar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.paleOrange },
  avatarText: { color: colors.orangeDark, fontSize: 15, fontWeight: '900' },
  formTitle: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  fieldLabel: { marginTop: 5, color: colors.ink, fontSize: 13, fontWeight: '900' },
  helper: { marginTop: -8, color: colors.muted, fontSize: 10, lineHeight: 15 },
  optional: { color: colors.muted, fontWeight: '600' },
  scoreRow: { flexDirection: 'row', gap: 6 },
  scoreButton: { flex: 1, minHeight: 55, alignItems: 'center', justifyContent: 'center', gap: 2, borderWidth: 1, borderColor: colors.line, borderRadius: 13, backgroundColor: colors.cream },
  scoreButtonSelected: { borderColor: colors.forest, backgroundColor: colors.forest },
  scoreNumber: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  scoreNumberSelected: { color: colors.white },
  scoreLabel: { marginTop: -7, color: colors.forest, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  binaryRow: { flexDirection: 'row', gap: 8 },
  choiceButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.cream },
  choiceButtonSelected: { borderColor: colors.forest, backgroundColor: colors.forest },
  choiceText: { color: colors.forest, fontSize: 12, fontWeight: '900' },
  choiceTextSelected: { color: colors.white },
  traitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  traitChip: { minHeight: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 12 },
  traitChipSelected: { borderColor: colors.grass, backgroundColor: colors.paleGreen },
  traitText: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  traitTextSelected: { color: colors.forest },
  noteInput: { minHeight: 90, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.cream, color: colors.ink, fontSize: 12, lineHeight: 18, padding: 12, textAlignVertical: 'top' },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  error: { color: colors.error, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  success: { color: colors.grass, fontSize: 11, lineHeight: 16, fontWeight: '800', textAlign: 'center' },
});
