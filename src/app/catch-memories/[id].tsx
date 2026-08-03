import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
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

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { StatePanel } from '@/components/ui/state-panel';
import { colors, radius, shadows, spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import {
  type CatchMemory,
  type CatchMemoryAsset,
  deleteCatchMemory,
  getMyCatchHighlightCredit,
  listCatchMemories,
  setCatchMemoryPublic,
  setMyCatchHighlightCredit,
  uploadCatchMemory,
} from '@/services/catch-memory-service';
import { validateCatchMemoryAsset } from '@/services/catch-memory-utils';
import { getCatchDetails, type HostedCatch } from '@/services/catch-service';

export default function CatchMemoriesScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [item, setItem] = useState<HostedCatch | null>(null);
  const [memories, setMemories] = useState<CatchMemory[]>([]);
  const [asset, setAsset] = useState<CatchMemoryAsset | null>(null);
  const [caption, setCaption] = useState('');
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [isSaving, setIsSaving] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [creditOptedIn, setCreditOptedIn] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;
    let active = true;
    void Promise.all([
      getCatchDetails(id),
      listCatchMemories(id),
      getMyCatchHighlightCredit(id, session.user.id),
    ]).then(
      ([catchResult, memoryResult, creditResult]) => {
        if (!active) return;
        setItem(catchResult.data);
        setMemories(memoryResult.data);
        setCreditOptedIn(creditResult.data);
        setError(catchResult.error ?? memoryResult.error ?? creditResult.error ?? '');
        setIsLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [id, session]);

  async function refreshMemories() {
    const result = await listCatchMemories(id);
    setMemories(result.data);
    if (result.error) setError(result.error);
  }

  async function chooseMedia(source: 'camera' | 'library') {
    setError('');
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('Camera permission is needed to capture a Catch memory.');
        return;
      }
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images', 'videos'],
            quality: 0.9,
            videoMaxDuration: 60,
            videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'videos'],
            quality: 0.9,
            videoMaxDuration: 60,
          });
    if (result.canceled || !result.assets[0]) return;
    const selected = result.assets[0];
    const validationError = validateCatchMemoryAsset({
      durationMilliseconds: selected.duration,
      fileSize: selected.fileSize,
      type: selected.type === 'video' ? 'video' : 'image',
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    setAsset({
      duration: selected.duration,
      fileSize: selected.fileSize,
      height: selected.height,
      mimeType: selected.mimeType,
      type: selected.type === 'video' ? 'video' : 'image',
      uri: selected.uri,
      width: selected.width,
    });
  }

  async function upload() {
    if (!asset || !session) return;
    setIsSaving(true);
    setError('');
    const result = await uploadCatchMemory({
      asset,
      caption,
      catchId: id,
      uploaderId: session.user.id,
    });
    setIsSaving(false);
    if (result.error) {
      setError(
        result.error.includes('catch-memories') || result.error.includes('catch_media')
          ? 'Catch Memories storage is not ready yet. Apply the completion and memories migration, then try again.'
          : result.error,
      );
      return;
    }
    setAsset(null);
    setCaption('');
    await refreshMemories();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function confirmDelete(memory: CatchMemory) {
    if (!session || memory.uploaderId !== session.user.id) return;
    Alert.alert('Remove this memory?', 'It will be removed from the Catch album.', [
      { style: 'cancel', text: 'Keep it' },
      {
        style: 'destructive',
        text: 'Remove',
        onPress: () => {
          void deleteCatchMemory(memory, session.user.id).then((result) => {
            if (result.error) {
              setError(result.error);
            } else {
              setMemories((current) => current.filter((item) => item.id !== memory.id));
            }
          });
        },
      },
    ]);
  }

  async function changeMemoryVisibility(memory: CatchMemory, isPublic: boolean) {
    setSharingId(memory.id);
    setError('');
    const result = await setCatchMemoryPublic(memory.id, isPublic);
    setSharingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMemories((current) =>
      current.map((candidate) =>
        candidate.id === memory.id
          ? { ...candidate, visibility: isPublic ? 'public' : 'private' }
          : candidate,
      ),
    );
    if (isPublic) setCreditOptedIn(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function confirmPublicShare(memory: CatchMemory) {
    Alert.alert(
      'Share this photo in Catch Highlights?',
      'It will be visible to signed-in Catch members. By continuing, you confirm everyone clearly shown gave permission. The location shown will stay broad and public.',
      [
        { style: 'cancel', text: 'Keep private' },
        {
          text: 'I have permission',
          onPress: () => void changeMemoryVisibility(memory, true),
        },
      ],
    );
  }

  async function toggleCredit() {
    const nextValue = !creditOptedIn;
    setError('');
    const result = await setMyCatchHighlightCredit(id, nextValue);
    if (result.error) {
      setError(result.error);
      return;
    }
    setCreditOptedIn(nextValue);
  }

  if (isLoading) {
    return (
      <Screen contentContainerStyle={styles.loading}>
        <ActivityIndicator color={colors.orange} size="large" />
        <Text style={styles.muted}>Opening the album…</Text>
      </Screen>
    );
  }
  if (!session) {
    return (
      <Screen>
        <StatePanel body="Sign in to view your completed Catch memories." icon="person-outline" title="Sign in first" />
      </Screen>
    );
  }
  if (!item) {
    return (
      <Screen>
        <StatePanel body={error || 'This album is available only to the completed Catch crew.'} icon="images-outline" title="Album unavailable" />
      </Screen>
    );
  }
  if (item.status !== 'completed') {
    return (
      <Screen>
        <StatePanel
          body="The host needs to mark this Catch complete before its private crew album opens."
          icon="time-outline"
          title="Memories open after the Catch"
        />
      </Screen>
    );
  }

  const highlightEligible =
    item.visibility === 'public' &&
    (item.locationType === 'catalog' || item.locationType === 'custom_public');

  return (
    <Screen>
      <View style={styles.heading}>
        <View style={[styles.activityIcon, { backgroundColor: item.activity.color }]}>
          <Text style={styles.emoji}>{item.activity.emoji}</Text>
        </View>
        <View style={styles.headingText}>
          <Text style={styles.eyebrow}>CATCH MEMORIES</Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.muted}>A private album for this Catch crew.</Text>
        </View>
      </View>

      <View style={styles.privacy}>
        <Ionicons color={colors.forest} name="shield-checkmark" size={22} />
        <Text style={styles.privacyText}>
          Photos and videos stay with approved participants. You can add memories later and remove anything you uploaded.
        </Text>
      </View>

      <View style={styles.highlightCard}>
        <View style={styles.highlightHeading}>
          <View style={styles.highlightIcon}>
            <Ionicons color={colors.orangeDark} name="sparkles" size={20} />
          </View>
          <View style={styles.headingText}>
            <Text style={styles.sectionTitle}>Catch Highlights</Text>
            <Text style={styles.muted}>
              {highlightEligible
                ? 'Choose individual photos to share with signed-in Catch members. Everything stays private unless you opt in.'
                : 'This album stays private because the Catch or its location was not public.'}
            </Text>
          </View>
        </View>
        {highlightEligible ? (
          <>
            <Pressable onPress={toggleCredit} style={styles.creditRow}>
              <Ionicons
                color={colors.forest}
                name={creditOptedIn ? 'checkbox' : 'square-outline'}
                size={23}
              />
              <View style={styles.headingText}>
                <Text style={styles.creditTitle}>Include my name</Text>
                <Text style={styles.muted}>You can hide your name without removing shared photos.</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => router.push('/catch-highlights' as never)}
              style={styles.browseButton}>
              <Text style={styles.browseText}>Browse Catch Highlights</Text>
              <Ionicons color={colors.forest} name="arrow-forward" size={18} />
            </Pressable>
          </>
        ) : null}
      </View>

      <View style={styles.addCard}>
        <Text style={styles.sectionTitle}>Add to the album</Text>
        <Text style={styles.muted}>Photos or videos up to 60 seconds and 50 MB.</Text>
        <View style={styles.pickerRow}>
          <Pressable onPress={() => chooseMedia('library')} style={styles.pickerButton}>
            <Ionicons color={colors.forest} name="images-outline" size={20} />
            <Text style={styles.pickerText}>Choose</Text>
          </Pressable>
          <Pressable onPress={() => chooseMedia('camera')} style={styles.pickerButton}>
            <Ionicons color={colors.forest} name="camera-outline" size={20} />
            <Text style={styles.pickerText}>Camera</Text>
          </Pressable>
        </View>
        {asset ? (
          <View style={styles.draft}>
            {asset.type === 'video' ? (
              <DraftVideo uri={asset.uri} />
            ) : (
              <Image contentFit="cover" source={asset.uri} style={styles.draftMedia} />
            )}
            <TextInput
              maxLength={280}
              multiline
              onChangeText={setCaption}
              placeholder="Add a caption (optional)"
              placeholderTextColor={colors.muted}
              style={styles.captionInput}
              value={caption}
            />
            <View style={styles.draftActions}>
              <Button label="Choose another" onPress={() => setAsset(null)} variant="secondary" />
              <Button disabled={isSaving} label={isSaving ? 'Uploading…' : 'Add memory'} onPress={upload} />
            </View>
          </View>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.albumHeading}>
        <Text style={styles.sectionTitle}>The album</Text>
        <Text style={styles.count}>{memories.length} {memories.length === 1 ? 'memory' : 'memories'}</Text>
      </View>
      {!memories.length ? (
        <StatePanel body="Add the first photo or short video whenever you’re ready." icon="images-outline" title="Nothing here yet" />
      ) : (
        <View style={styles.album}>
          {memories.map((memory) => (
            <View key={memory.id} style={styles.memoryCard}>
              {memory.mediaType === 'video' ? (
                <MemoryVideo url={memory.url} />
              ) : (
                <Image contentFit="cover" source={memory.url} style={styles.memoryMedia} transition={180} />
              )}
              <View style={styles.memoryBody}>
                <View style={styles.memoryTop}>
                  <View style={styles.byline}>
                    <Text style={styles.uploader}>{memory.uploaderName}</Text>
                    <Text style={styles.date}>{formatMemoryDate(memory.createdAt)}</Text>
                  </View>
                  {memory.uploaderId === session.user.id ? (
                    <Pressable accessibilityLabel="Remove memory" onPress={() => confirmDelete(memory)} style={styles.deleteButton}>
                      <Ionicons color={colors.error} name="trash-outline" size={19} />
                    </Pressable>
                  ) : null}
                </View>
                {memory.caption ? <Text style={styles.caption}>{memory.caption}</Text> : null}
                <View style={styles.visibilityRow}>
                  {memory.mediaType === 'video' ? (
                    <View style={styles.privateBadge}>
                      <Ionicons color={colors.muted} name="lock-closed" size={14} />
                      <Text style={styles.privateBadgeText}>Private video</Text>
                    </View>
                  ) : memory.moderationStatus === 'hidden' ? (
                    <View style={styles.hiddenBadge}>
                      <Ionicons color={colors.error} name="eye-off" size={14} />
                      <Text style={styles.hiddenBadgeText}>Hidden pending review</Text>
                    </View>
                  ) : memory.visibility === 'public' ? (
                    <>
                      <View style={styles.publicBadge}>
                        <Ionicons color={colors.forest} name="sparkles" size={14} />
                        <Text style={styles.publicBadgeText}>Public highlight</Text>
                      </View>
                      {memory.uploaderId === session.user.id ? (
                        <Pressable
                          disabled={sharingId === memory.id}
                          onPress={() => void changeMemoryVisibility(memory, false)}>
                          <Text style={styles.visibilityAction}>Make private</Text>
                        </Pressable>
                      ) : null}
                    </>
                  ) : highlightEligible && memory.uploaderId === session.user.id ? (
                    <Pressable
                      disabled={sharingId === memory.id}
                      onPress={() => confirmPublicShare(memory)}
                      style={styles.shareButton}>
                      <Ionicons color={colors.forest} name="sparkles-outline" size={16} />
                      <Text style={styles.shareButtonText}>
                        {sharingId === memory.id ? 'Sharing…' : 'Share publicly'}
                      </Text>
                    </Pressable>
                  ) : (
                    <View style={styles.privateBadge}>
                      <Ionicons color={colors.muted} name="lock-closed" size={14} />
                      <Text style={styles.privateBadgeText}>Private</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

function DraftVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return <VideoView contentFit="contain" nativeControls player={player} style={styles.draftMedia} />;
}

function MemoryVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url);
  return <VideoView contentFit="contain" nativeControls player={player} style={styles.memoryMedia} />;
}

function formatMemoryDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: new Date(value).getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  }).format(new Date(value));
}

const styles = StyleSheet.create({
  loading: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: spacing.md },
  headingText: { flex: 1, gap: 3 },
  activityIcon: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  emoji: { fontSize: 31 },
  eyebrow: { color: colors.orangeDark, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginTop: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.paleGreen, padding: spacing.md },
  privacyText: { flex: 1, color: colors.forest, fontSize: 12, lineHeight: 18 },
  highlightCard: { gap: 13, marginTop: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: colors.paper, padding: spacing.md },
  highlightHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  highlightIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.paleOrange },
  creditRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.md, backgroundColor: colors.paleGreen, padding: 12 },
  creditTitle: { color: colors.forest, fontSize: 13, fontWeight: '800' },
  browseButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.white },
  browseText: { color: colors.forest, fontSize: 12, fontWeight: '800' },
  addCard: { gap: 10, marginTop: spacing.lg, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: colors.paper, padding: spacing.md, ...shadows.card },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  pickerRow: { flexDirection: 'row', gap: 10 },
  pickerButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.white },
  pickerText: { color: colors.forest, fontSize: 13, fontWeight: '800' },
  draft: { gap: 10 },
  draftMedia: { width: '100%', height: 230, borderRadius: radius.md, backgroundColor: colors.ink },
  captionInput: { minHeight: 76, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.white, color: colors.ink, fontSize: 13, padding: 13, textAlignVertical: 'top' },
  draftActions: { gap: 9 },
  error: { marginTop: spacing.md, color: colors.error, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  albumHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl },
  count: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  album: { gap: 15, marginTop: spacing.md },
  memoryCard: { overflow: 'hidden', borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: colors.paper, ...shadows.card },
  memoryMedia: { width: '100%', height: 280, backgroundColor: colors.ink },
  memoryBody: { gap: 7, padding: 13 },
  memoryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  byline: { gap: 2 },
  uploader: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  date: { color: colors.muted, fontSize: 10 },
  deleteButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.paleOrange },
  caption: { color: colors.ink, fontSize: 13, lineHeight: 19 },
  visibilityRow: { minHeight: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  privateBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  privateBadgeText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  hiddenBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  hiddenBadgeText: { color: colors.error, fontSize: 10, fontWeight: '800' },
  publicBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 99, backgroundColor: colors.paleGreen, paddingHorizontal: 9, paddingVertical: 6 },
  publicBadgeText: { color: colors.forest, fontSize: 10, fontWeight: '900' },
  visibilityAction: { color: colors.orangeDark, fontSize: 11, fontWeight: '800' },
  shareButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, backgroundColor: colors.paleGreen, paddingHorizontal: 11 },
  shareButtonText: { color: colors.forest, fontSize: 11, fontWeight: '800' },
});
