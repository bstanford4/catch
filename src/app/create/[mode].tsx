import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Screen } from '@/components/ui/screen';
import { activities } from '@/data/demo';
import { colors, radius, spacing } from '@/constants/theme';

const copy = {
  now: {
    eyebrow: 'CATCH NOW',
    title: 'What are you up for?',
    subtitle: 'Tell nearby people what sounds good in the next few hours.',
    submit: 'Post Catch Now',
  },
  scheduled: {
    eyebrow: 'POST A CATCH',
    title: 'Put a good plan on the board.',
    subtitle: 'Pick the basics now. Fine-tune the details with your catch crew.',
    submit: 'Post this Catch',
  },
  open: {
    eyebrow: 'OPEN TO CATCH',
    title: 'Let a good plan find you.',
    subtitle: 'Share broad availability—not your exact routine or address.',
    submit: 'Turn on Open to Catch',
  },
} as const;

export default function CreateModeScreen() {
  const params = useLocalSearchParams<{ mode?: string; activity?: string }>();
  const router = useRouter();
  const mode = params.mode === 'now' || params.mode === 'open' ? params.mode : 'scheduled';
  const labels = copy[mode];
  const [activity, setActivity] = useState(params.activity ?? 'baseball');
  const [duration, setDuration] = useState('45 min');
  const [note, setNote] = useState('');
  const selectedActivity = useMemo(
    () => activities.find((item) => item.id === activity) ?? activities[0],
    [activity],
  );

  function submit() {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Looking good',
      `${selectedActivity.name} is ready for the board. Demo mode keeps this preview on your device.`,
      [{ text: 'Back home', onPress: () => router.replace('/(tabs)') }],
    );
  }

  return (
    <Screen>
      <Text style={styles.eyebrow}>{labels.eyebrow}</Text>
      <Text style={styles.title}>{labels.title}</Text>
      <Text style={styles.subtitle}>{labels.subtitle}</Text>

      <Text style={styles.label}>Activity</Text>
      <View style={styles.activityGrid}>
        {activities.map((item) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: activity === item.id }}
            key={item.id}
            onPress={() => setActivity(item.id)}
            style={[
              styles.activity,
              activity === item.id && styles.activitySelected,
            ]}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text
              style={[styles.activityName, activity === item.id && styles.activityNameSelected]}>
              {item.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.row}>
        <View style={styles.fieldHalf}>
          <Text style={styles.label}>When</Text>
          <Pressable accessibilityRole="button" style={styles.field}>
            <Ionicons color={colors.forest} name="calendar-outline" size={18} />
            <Text style={styles.fieldText}>
              {mode === 'now' ? 'Today, 6:15 PM' : mode === 'open' ? 'Wed & Fri' : 'Tomorrow, 7 PM'}
            </Text>
          </Pressable>
        </View>
        <View style={styles.fieldHalf}>
          <Text style={styles.label}>Duration</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDuration(duration === '45 min' ? '60 min' : '45 min')}
            style={styles.field}>
            <Ionicons color={colors.forest} name="timer-outline" size={18} />
            <Text style={styles.fieldText}>{duration}</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.label}>General area</Text>
      <Pressable accessibilityRole="button" style={styles.field}>
        <Ionicons color={colors.forest} name="location-outline" size={18} />
        <View style={styles.locationText}>
          <Text style={styles.fieldText}>
            {mode === 'open' ? 'North Stafford' : 'Choose a public venue'}
          </Text>
          <Text style={styles.helper}>Exact private locations are hidden before approval.</Text>
        </View>
        <Ionicons color={colors.muted} name="chevron-forward" size={18} />
      </Pressable>

      <Text style={styles.label}>Vibe</Text>
      <View style={styles.chips}>
        <Chip label="Easygoing" selected />
        <Chip label="Beginner-friendly" />
        <Chip label="Bring the heat" />
      </View>

      <Text style={styles.label}>Anything worth knowing?</Text>
      <TextInput
        accessibilityLabel="Optional catch description"
        maxLength={280}
        multiline
        onChangeText={setNote}
        placeholder="Extra glove available, field two, water breaks encouraged…"
        placeholderTextColor={colors.muted}
        style={styles.note}
        value={note}
      />
      <Text style={styles.counter}>{note.length}/280</Text>

      <View style={styles.preview}>
        <View style={[styles.previewIcon, { backgroundColor: selectedActivity.color }]}>
          <Text style={styles.previewEmoji}>{selectedActivity.emoji}</Text>
        </View>
        <View style={styles.previewText}>
          <Text style={styles.previewEyebrow}>YOUR PREVIEW</Text>
          <Text style={styles.previewTitle}>{selectedActivity.name} · {duration}</Text>
          <Text style={styles.previewBody}>Visible within 10 miles · broad location only</Text>
        </View>
      </View>

      <Button icon="paper-plane" label={labels.submit} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    marginTop: spacing.sm,
    color: colors.orangeDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    maxWidth: 390,
    color: colors.ink,
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: -1,
  },
  subtitle: {
    maxWidth: 430,
    marginTop: 5,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  label: {
    marginTop: spacing.lg,
    marginBottom: 8,
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activity: {
    minWidth: '23%',
    flexGrow: 1,
    minHeight: 70,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    padding: 8,
  },
  activitySelected: {
    borderColor: colors.forest,
    backgroundColor: colors.paleGreen,
  },
  emoji: {
    fontSize: 23,
  },
  activityName: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  activityNameSelected: {
    color: colors.forest,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  fieldHalf: {
    flex: 1,
  },
  field: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fieldText: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  locationText: {
    flex: 1,
    gap: 2,
  },
  helper: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  note: {
    minHeight: 106,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    padding: 14,
    textAlignVertical: 'top',
  },
  counter: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 10,
    textAlign: 'right',
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.paleGreen,
    padding: 13,
  },
  previewIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  previewEmoji: {
    fontSize: 25,
  },
  previewText: {
    flex: 1,
    gap: 2,
  },
  previewEyebrow: {
    color: colors.grass,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  previewTitle: {
    color: colors.forest,
    fontSize: 14,
    fontWeight: '800',
  },
  previewBody: {
    color: colors.muted,
    fontSize: 10,
  },
});

