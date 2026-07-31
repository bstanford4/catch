import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { activityEmojiBySlug } from '@/constants/activity-catalog';
import { colors, radius, spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import {
  getMyEditableProfile,
  updateMyProfile,
} from '@/services/profile-service';
import { formatMemberName, normalizeLastInitial } from '@/utils/member-name';

type ActivityOption = {
  emoji: string;
  name: string;
  slug: string;
};

export default function EditProfileScreen() {
  const router = useRouter();
  const { profile, refreshProfile, session } = useAuth();
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastInitial, setLastInitial] = useState(profile?.lastInitial ?? '');
  const [bio, setBio] = useState('');
  const [activities, setActivities] = useState<ActivityOption[]>([]);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(profile?.activitySlugs ?? []);
  const [previousPhotoPath, setPreviousPhotoPath] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string>();
  const [removeExistingPhoto, setRemoveExistingPhoto] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(session && supabase));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const previewPhotoUri =
    photoUri ?? (!removeExistingPhoto ? existingPhotoUrl ?? undefined : undefined);

  useEffect(() => {
    if (!session || !supabase) return;
    let active = true;
    void Promise.all([
      getMyEditableProfile(session.user.id),
      supabase
        .from('activity_types')
        .select('slug, name, emoji')
        .eq('active', true)
        .order('sort_order'),
    ]).then(([profileResult, activityResult]) => {
      if (!active) return;
      if (profileResult.data) {
        setFirstName(profileResult.data.firstName);
        setLastInitial(profileResult.data.lastInitial);
        setBio(profileResult.data.bio);
        setSelectedSlugs(profileResult.data.activitySlugs);
        setPreviousPhotoPath(profileResult.data.photoPath);
        setExistingPhotoUrl(profileResult.data.photoUrl);
      }
      if (profileResult.error || !profileResult.data) {
        setError(profileResult.error ?? 'Your profile could not be loaded.');
      }
      if (activityResult.error) {
        setError(activityResult.error.message);
      } else {
        setActivities(
          ((activityResult.data ?? []) as ActivityOption[]).map((activity) => ({
            ...activity,
            emoji: activityEmojiBySlug[activity.slug] ?? activity.emoji ?? '🏅',
          })),
        );
      }
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [session]);

  async function choosePhoto(source: 'camera' | 'library') {
    setError('');
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('Camera permission is needed to take a profile photo.');
        return;
      }
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            mediaTypes: ['images'],
            quality: 0.9,
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [1, 1],
            mediaTypes: ['images'],
            quality: 0.9,
          });
    if (!result.canceled) {
      setPhotoUri(result.assets[0]?.uri);
      setRemoveExistingPhoto(false);
    }
  }

  function toggleActivity(slug: string) {
    setSelectedSlugs((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug],
    );
  }

  async function save() {
    if (!session) return;
    setIsSaving(true);
    setError('');
    const result = await updateMyProfile({
      activitySlugs: selectedSlugs,
      bio,
      firstName,
      lastInitial,
      photoUri,
      previousPhotoPath,
      removeExistingPhoto,
      userId: session.user.id,
    });
    setIsSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    await refreshProfile();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }

  if (isLoading) {
    return (
      <Screen contentContainerStyle={styles.loading}>
        <ActivityIndicator color={colors.orange} size="large" />
        <Text style={styles.muted}>Opening your profile...</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>YOUR CATCH CARD</Text>
        <Text style={styles.title}>Show people who they’re catching with.</Text>
        <Text style={styles.intro}>
          Your bio and photo are visible only to Catch Mates and approved people in a shared Catch.
        </Text>
      </View>

      <View style={styles.photoSection}>
        <View style={styles.photoFrame}>
          {previewPhotoUri ? (
            <Image contentFit="cover" source={previewPhotoUri} style={styles.photo} />
          ) : (
            <View style={styles.photoFallback}>
              <Text style={styles.initials}>
                {(firstName.trim().slice(0, 2) || 'C').toUpperCase()}
              </Text>
            </View>
          )}
          {previewPhotoUri ? (
            <Pressable
              accessibilityLabel="Remove profile photo"
              onPress={() => {
                setPhotoUri(undefined);
                setRemoveExistingPhoto(true);
              }}
              style={styles.removePhoto}>
              <Ionicons color={colors.white} name="close" size={18} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.photoActions}>
          <Pressable onPress={() => choosePhoto('library')} style={styles.photoAction}>
            <Ionicons color={colors.forest} name="images-outline" size={19} />
            <Text style={styles.photoActionText}>Choose photo</Text>
          </Pressable>
          <Pressable onPress={() => choosePhoto('camera')} style={styles.photoAction}>
            <Ionicons color={colors.forest} name="camera-outline" size={19} />
            <Text style={styles.photoActionText}>Take photo</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>First name</Text>
        <TextInput
          autoCapitalize="words"
          maxLength={60}
          onChangeText={setFirstName}
          placeholder="Your first name"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={firstName}
        />

        <Text style={styles.label}>Last initial (optional)</Text>
        <TextInput
          autoCapitalize="characters"
          maxLength={1}
          onChangeText={(value) => setLastInitial(normalizeLastInitial(value))}
          placeholder="Example: S"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={lastInitial}
        />
        <Text style={styles.help}>
          Other members will see “{formatMemberName(firstName || 'Blake', lastInitial)}.”
        </Text>

        <View style={styles.labelRow}>
          <Text style={styles.label}>Bio</Text>
          <Text style={styles.counter}>{bio.length}/500</Text>
        </View>
        <TextInput
          maxLength={500}
          multiline
          onChangeText={setBio}
          placeholder="A little about you, what you like to play, or the kind of Catch you enjoy."
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.bioInput]}
          textAlignVertical="top"
          value={bio}
        />

        <Text style={styles.label}>Activities</Text>
        <Text style={styles.help}>Choose everything you’d be happy to play.</Text>
        <View style={styles.activityGrid}>
          {activities.map((activity) => {
            const selected = selectedSlugs.includes(activity.slug);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                key={activity.slug}
                onPress={() => toggleActivity(activity.slug)}
                style={[styles.activity, selected && styles.activitySelected]}>
                <Text style={styles.activityEmoji}>{activity.emoji}</Text>
                <Text style={[styles.activityName, selected && styles.activityNameSelected]}>
                  {activity.name}
                </Text>
                {selected ? (
                  <Ionicons color={colors.white} name="checkmark-circle" size={17} />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          disabled={isSaving}
          label={isSaving ? 'Saving profile...' : 'Save profile'}
          onPress={save}
        />
      </View>

      <View style={styles.privacyNote}>
        <Ionicons color={colors.forest} name="shield-checkmark" size={20} />
        <Text style={styles.privacyText}>
          Your photo is stored privately. Email, exact location, and age information are never
          included on your participant profile.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: 12, paddingTop: 100 },
  muted: { color: colors.muted, fontSize: 13 },
  heading: { gap: 7, marginTop: spacing.md },
  eyebrow: { color: colors.orangeDark, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  title: { maxWidth: 600, color: colors.ink, fontSize: 30, fontWeight: '900', letterSpacing: -0.8 },
  intro: { maxWidth: 620, color: colors.muted, fontSize: 14, lineHeight: 21 },
  photoSection: {
    alignItems: 'center',
    gap: 14,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    padding: spacing.lg,
  },
  photoFrame: { position: 'relative' },
  photo: { width: 132, height: 132, borderRadius: 66 },
  photoFallback: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 66,
    backgroundColor: colors.paleOrange,
  },
  initials: { color: colors.forest, fontSize: 40, fontWeight: '900' },
  removePhoto: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: 'rgba(23,33,27,0.82)',
  },
  photoActions: { width: '100%', flexDirection: 'row', gap: 9 },
  photoAction: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  photoActionText: { color: colors.forest, fontSize: 12, fontWeight: '800' },
  form: {
    gap: 11,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    padding: spacing.md,
  },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  label: { marginTop: 4, color: colors.ink, fontSize: 13, fontWeight: '800' },
  counter: { color: colors.muted, fontSize: 11 },
  help: { marginTop: -6, color: colors.muted, fontSize: 11 },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    color: colors.ink,
    fontSize: 15,
    paddingHorizontal: 14,
  },
  bioInput: { minHeight: 120, lineHeight: 21, paddingTop: 13, paddingBottom: 13 },
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  activity: {
    minWidth: 105,
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: 9,
  },
  activitySelected: { borderColor: colors.forest, backgroundColor: colors.forest },
  activityEmoji: { fontSize: 20 },
  activityName: { color: colors.forest, fontSize: 12, fontWeight: '800' },
  activityNameSelected: { color: colors.white },
  error: { color: colors.error, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  privacyNote: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.paleGreen,
    padding: 14,
  },
  privacyText: { flex: 1, color: colors.forest, fontSize: 11, lineHeight: 17 },
});
