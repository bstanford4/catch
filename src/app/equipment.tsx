import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { colors, radius, shadows, spacing } from '@/constants/theme';
import { activities } from '@/data/demo';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import {
  createEquipment,
  deleteEquipment,
  type EquipmentItem,
  listEquipment,
  updateEquipment,
} from '@/services/equipment-service';

type ActivityOption = {
  emoji: string;
  id: string;
  name: string;
  slug: string;
};

const conditions = ['Excellent', 'Good', 'Well-loved'];
const activityEmojiBySlug: Record<string, string> = {
  baseball: '⚾',
  softball: '🥎',
  football: '🏈',
  frisbee: '🥏',
  lacrosse: '🥍',
  soccer: '⚽',
  basketball: '🏀',
  tennis: '🎾',
  pickleball: '🏓',
  pong: '🏓',
  die: '🎲',
  other: '✨',
};

export default function EquipmentScreen() {
  const { profile, session } = useAuth();
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [catalog, setCatalog] = useState<ActivityOption[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null);
  const [name, setName] = useState('');
  const [activityTypeId, setActivityTypeId] = useState('');
  const [condition, setCondition] = useState('Good');
  const [quantity, setQuantity] = useState(1);
  const [canShare, setCanShare] = useState(false);
  const [photoUri, setPhotoUri] = useState<string>();
  const [removeExistingPhoto, setRemoveExistingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState('');
  const [error, setError] = useState('');

  const catalogById = useMemo(
    () => new Map(catalog.map((activity) => [activity.id, activity])),
    [catalog],
  );
  const previewPhotoUri =
    photoUri ?? (!removeExistingPhoto ? editingItem?.photoUrl ?? undefined : undefined);

  useEffect(() => {
    if (!session || !supabase) return;

    let active = true;
    const preferredSlugs = profile?.activitySlugs ?? [];
    void Promise.all([
      supabase
        .from('activity_types')
        .select('id, slug, name, emoji')
        .eq('active', true)
        .order('sort_order'),
      listEquipment(session.user.id),
    ]).then(([activityResult, equipmentResult]) => {
      if (!active) return;
      if (activityResult.error) {
        setError(activityResult.error.message);
      } else {
        const rows = ((activityResult.data ?? []) as ActivityOption[]).map((activity) => ({
          ...activity,
          // Use the local catalog for display so a legacy encoding problem in
          // seeded database text cannot leak into the interface.
          emoji: activityEmojiBySlug[activity.slug] ?? activity.emoji ?? '🏅',
        }));
        const sorted = [...rows].sort((a, b) => {
          const aPreferred = preferredSlugs.includes(a.slug) ? 0 : 1;
          const bPreferred = preferredSlugs.includes(b.slug) ? 0 : 1;
          return aPreferred - bPreferred;
        });
        setCatalog(sorted);
        setActivityTypeId(sorted[0]?.id ?? '');
      }
      if (equipmentResult.error) setError(equipmentResult.error);
      setItems(equipmentResult.data);
      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [profile?.activitySlugs, session]);

  async function choosePhoto(source: 'camera' | 'library') {
    setError('');
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('Camera permission is needed to take an equipment photo.');
        return;
      }
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 3],
            mediaTypes: ['images'],
            quality: 0.9,
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [4, 3],
            mediaTypes: ['images'],
            quality: 0.9,
          });
    if (!result.canceled) {
      setPhotoUri(result.assets[0]?.uri);
      setRemoveExistingPhoto(false);
    }
  }

  function resetForm() {
    setName('');
    setCondition('Good');
    setQuantity(1);
    setCanShare(false);
    setPhotoUri(undefined);
    setRemoveExistingPhoto(false);
    setEditingItem(null);
    setShowForm(false);
  }

  function editItem(item: EquipmentItem) {
    setEditingItem(item);
    setName(item.name);
    setActivityTypeId(item.activityTypeId);
    setCondition(item.condition ?? 'Good');
    setQuantity(item.quantity);
    setCanShare(item.canShare);
    setPhotoUri(undefined);
    setRemoveExistingPhoto(false);
    setConfirmDeleteId('');
    setError('');
    setShowForm(true);
  }

  async function saveItem() {
    if (!session) {
      setError('Sign in to add equipment.');
      return;
    }
    if (!name.trim()) {
      setError('Give this item a name.');
      return;
    }
    if (!activityTypeId) {
      setError('Choose an activity.');
      return;
    }

    setIsSaving(true);
    setError('');
    const input = {
      activityTypeId,
      canShare,
      condition,
      name,
      photoUri,
      quantity,
      userId: session.user.id,
    };
    const result = editingItem
      ? await updateEquipment({
          ...input,
          item: editingItem,
          removeExistingPhoto,
        })
      : await createEquipment(input);
    setIsSaving(false);
    if (result.error || !result.data) {
      setError(
        result.error?.includes('Bucket not found')
          ? 'Photo storage is not ready yet. Apply the equipment storage migration, then try again.'
          : result.error ?? 'Could not save that item.',
      );
      return;
    }
    setItems((current) =>
      editingItem
        ? current.map((item) => (item.id === result.data!.id ? result.data! : item))
        : [result.data!, ...current],
    );
    resetForm();
  }

  async function removeItem(item: EquipmentItem) {
    if (confirmDeleteId !== item.id) {
      setConfirmDeleteId(item.id);
      return;
    }
    setDeletingId(item.id);
    setError('');
    const result = await deleteEquipment(item);
    setDeletingId('');
    setConfirmDeleteId('');
    if (result.error) {
      setError(result.error);
      return;
    }
    setItems((current) => current.filter((candidate) => candidate.id !== item.id));
  }

  return (
    <Screen>
      <View style={styles.headingRow}>
        <View style={styles.headingText}>
          <Text style={styles.eyebrow}>GEAR LOCKER</Text>
          <Text style={styles.title}>Your equipment</Text>
          <Text style={styles.intro}>Keep track of what you own and what you’re happy to share.</Text>
        </View>
        {!showForm ? (
          <Pressable
            accessibilityLabel="Add equipment"
            onPress={() => setShowForm(true)}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
            <Ionicons color={colors.white} name="add" size={25} />
          </Pressable>
        ) : null}
      </View>

      {showForm ? (
        <View style={styles.formCard}>
          <View style={styles.formHeading}>
            <Text style={styles.formTitle}>{editingItem ? 'Edit item' : 'Add an item'}</Text>
            <Pressable accessibilityLabel="Close add equipment form" onPress={resetForm}>
              <Ionicons color={colors.muted} name="close" size={24} />
            </Pressable>
          </View>

          <Text style={styles.label}>Item name</Text>
          <TextInput
            accessibilityLabel="Equipment name"
            maxLength={80}
            onChangeText={setName}
            placeholder="e.g. Wilson A2000 glove"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={name}
          />

          <Text style={styles.label}>Activity</Text>
          <View style={styles.chipRow}>
            {catalog.map((activity) => {
              const selected = activityTypeId === activity.id;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={activity.id}
                  onPress={() => setActivityTypeId(activity.id)}
                  style={[styles.chip, selected && styles.chipSelected]}>
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {activity.emoji} {activity.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Condition</Text>
          <View style={styles.chipRow}>
            {conditions.map((value) => {
              const selected = condition === value;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={value}
                  onPress={() => setCondition(value)}
                  style={[styles.chip, selected && styles.chipSelected]}>
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{value}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Quantity</Text>
          <View style={styles.quantityRow}>
            <Pressable
              accessibilityLabel="Decrease quantity"
              disabled={quantity === 1}
              onPress={() => setQuantity((value) => Math.max(1, value - 1))}
              style={styles.quantityButton}>
              <Ionicons color={colors.forest} name="remove" size={20} />
            </Pressable>
            <Text style={styles.quantity}>{quantity}</Text>
            <Pressable
              accessibilityLabel="Increase quantity"
              onPress={() => setQuantity((value) => Math.min(99, value + 1))}
              style={styles.quantityButton}>
              <Ionicons color={colors.forest} name="add" size={20} />
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: canShare }}
            onPress={() => setCanShare((value) => !value)}
            style={styles.shareRow}>
            <View style={[styles.checkbox, canShare && styles.checkboxSelected]}>
              {canShare ? <Ionicons color={colors.white} name="checkmark" size={15} /> : null}
            </View>
            <View style={styles.shareText}>
              <Text style={styles.shareLabel}>Available to share</Text>
              <Text style={styles.shareDetail}>Mark gear you’d be willing to bring to a catch.</Text>
            </View>
          </Pressable>

          <Text style={styles.label}>Photo (optional)</Text>
          {previewPhotoUri ? (
            <View style={styles.photoPreview}>
              <Image contentFit="cover" source={previewPhotoUri} style={styles.photo} />
              <Pressable
                accessibilityLabel="Remove equipment photo"
                onPress={() => {
                  setPhotoUri(undefined);
                  setRemoveExistingPhoto(true);
                }}
                style={styles.removePhoto}>
                <Ionicons color={colors.white} name="close" size={18} />
              </Pressable>
            </View>
          ) : null}
          <View style={styles.photoActions}>
            <Pressable onPress={() => choosePhoto('library')} style={styles.photoAction}>
              <Ionicons color={colors.forest} name="images-outline" size={19} />
              <Text style={styles.photoActionText}>Choose photo</Text>
            </Pressable>
            <Pressable onPress={() => choosePhoto('camera')} style={styles.photoAction}>
              <Ionicons color={colors.forest} name="camera-outline" size={20} />
              <Text style={styles.photoActionText}>Take photo</Text>
            </Pressable>
          </View>

          <Button
            disabled={isSaving}
            label={isSaving ? 'Saving item…' : editingItem ? 'Save changes' : 'Save equipment'}
            onPress={saveItem}
          />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {isLoading ? <Text style={styles.status}>Opening your gear locker…</Text> : null}
      {!isLoading && items.length === 0 && !showForm ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons color={colors.forest} name="basketball-outline" size={30} />
          </View>
          <Text style={styles.emptyTitle}>No equipment added yet</Text>
          <Text style={styles.emptyText}>
            Add a ball, glove, racket, or anything else you use for a catch.
          </Text>
          <Button label="Add your first item" onPress={() => setShowForm(true)} variant="secondary" />
        </View>
      ) : null}

      <View style={styles.itemList}>
        {items.map((item) => {
          const activity = catalogById.get(item.activityTypeId);
          const fallback = activities.find((candidate) => candidate.id === activity?.slug);
          return (
            <View key={item.id} style={styles.itemCard}>
              {item.photoUrl ? (
                <Image contentFit="cover" source={item.photoUrl} style={styles.itemPhoto} />
              ) : (
                <View style={styles.itemPhotoFallback}>
                  <Text style={styles.itemEmoji}>{activity?.emoji ?? fallback?.emoji ?? '🏅'}</Text>
                </View>
              )}
              <View style={styles.itemBody}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  {activity?.name ?? fallback?.name ?? 'Equipment'} · {item.condition ?? 'Condition not set'}
                  {item.quantity > 1 ? ` · Qty ${item.quantity}` : ''}
                </Text>
                {item.canShare ? <Text style={styles.shareBadge}>AVAILABLE TO SHARE</Text> : null}
              </View>
              <View style={styles.itemActions}>
                <Pressable
                  accessibilityLabel={`Edit ${item.name}`}
                  onPress={() => editItem(item)}
                  style={styles.itemActionButton}>
                  <Ionicons color={colors.forest} name="pencil-outline" size={19} />
                  <Text style={styles.editText}>Edit</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Remove ${item.name}`}
                  disabled={deletingId === item.id}
                  onPress={() => removeItem(item)}
                  style={styles.itemActionButton}>
                  <Ionicons
                    color={confirmDeleteId === item.id ? colors.error : colors.muted}
                    name={confirmDeleteId === item.id ? 'checkmark-circle-outline' : 'trash-outline'}
                    size={20}
                  />
                  <Text
                    style={[
                      styles.actionText,
                      confirmDeleteId === item.id && styles.confirmText,
                    ]}>
                    {confirmDeleteId === item.id ? 'Confirm' : 'Remove'}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.privacyNote}>
        <Ionicons color={colors.forest} name="lock-closed" size={18} />
        <Text style={styles.privacyText}>
          Photos are stored privately. Catch only gives signed-in users temporary access when
          they’re allowed to view the equipment.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginTop: spacing.md,
  },
  headingText: { flex: 1, gap: 7 },
  eyebrow: { color: colors.orangeDark, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '900', letterSpacing: -0.8 },
  intro: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  addButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: colors.orange,
    ...shadows.card,
  },
  formCard: {
    gap: 11,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    padding: spacing.md,
  },
  formHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formTitle: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  label: { marginTop: 5, color: colors.ink, fontSize: 12, fontWeight: '800' },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    color: colors.ink,
    fontSize: 14,
    paddingHorizontal: 14,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chipSelected: { borderColor: colors.forest, backgroundColor: colors.forest },
  chipText: { color: colors.forest, fontSize: 12, fontWeight: '700' },
  chipTextSelected: { color: colors.white },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  quantityButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  quantity: { minWidth: 24, color: colors.ink, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: radius.md,
    backgroundColor: colors.paleGreen,
    padding: 13,
  },
  checkbox: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  checkboxSelected: { borderColor: colors.forest, backgroundColor: colors.forest },
  shareText: { flex: 1 },
  shareLabel: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  shareDetail: { marginTop: 2, color: colors.muted, fontSize: 11 },
  photoPreview: { position: 'relative', overflow: 'hidden', borderRadius: radius.md },
  photo: { width: '100%', aspectRatio: 4 / 3 },
  removePhoto: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(23,33,27,0.78)',
  },
  photoActions: { flexDirection: 'row', gap: 9, marginBottom: 4 },
  photoAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  photoActionText: { color: colors.forest, fontSize: 12, fontWeight: '800' },
  error: { marginTop: spacing.md, color: colors.error, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  status: { marginTop: spacing.xl, color: colors.muted, textAlign: 'center' },
  empty: {
    alignItems: 'center',
    gap: 9,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    padding: spacing.xl,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.paleGreen,
  },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  emptyText: { maxWidth: 350, color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  itemList: { gap: 11, marginTop: spacing.lg },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    padding: 11,
  },
  itemPhoto: { width: 70, height: 70, borderRadius: 16 },
  itemPhotoFallback: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.paleGreen,
  },
  itemEmoji: { fontSize: 30 },
  itemBody: { flex: 1, gap: 4 },
  itemName: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  itemMeta: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  shareBadge: { color: colors.orangeDark, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  itemActionButton: { alignItems: 'center', gap: 2, padding: 6 },
  editText: { color: colors.forest, fontSize: 9, fontWeight: '800' },
  actionText: { color: colors.muted, fontSize: 9, fontWeight: '800' },
  confirmText: { color: colors.error },
  privacyNote: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.paleGreen,
    padding: 14,
  },
  privacyText: { flex: 1, color: colors.forest, fontSize: 11, lineHeight: 17 },
  pressed: { opacity: 0.74 },
});
