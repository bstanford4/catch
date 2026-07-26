import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';

export type EquipmentItem = {
  activityTypeId: string;
  canShare: boolean;
  condition: string | null;
  id: string;
  name: string;
  photoPath: string | null;
  photoUrl: string | null;
  quantity: number;
};

export type NewEquipmentInput = {
  activityTypeId: string;
  canShare: boolean;
  condition: string;
  name: string;
  photoUri?: string;
  quantity: number;
  userId: string;
};

type EquipmentRow = {
  activity_type_id: string;
  can_share: boolean;
  condition: string | null;
  equipment_photos: { storage_path: string }[] | null;
  id: string;
  name: string;
  quantity: number;
};

async function createPhotoUrl(path: string | null) {
  if (!supabase || !path) return null;
  const { data } = await supabase.storage.from('equipment-photos').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

async function mapEquipment(row: EquipmentRow): Promise<EquipmentItem> {
  const photoPath = row.equipment_photos?.[0]?.storage_path ?? null;
  return {
    activityTypeId: row.activity_type_id,
    canShare: row.can_share,
    condition: row.condition,
    id: row.id,
    name: row.name,
    photoPath,
    photoUrl: await createPhotoUrl(photoPath),
    quantity: row.quantity,
  };
}

export async function listEquipment(userId: string) {
  if (!supabase) return { data: [] as EquipmentItem[], error: 'Supabase is not configured.' };
  const { data, error } = await supabase
    .from('equipment_items')
    .select(
      'id, name, condition, quantity, can_share, activity_type_id, equipment_photos(storage_path)',
    )
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) return { data: [] as EquipmentItem[], error: error.message };
  return {
    data: await Promise.all(((data ?? []) as EquipmentRow[]).map(mapEquipment)),
    error: null,
  };
}

async function preparePhoto(uri: string) {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: 1600, height: null });
  const rendered = await context.renderAsync();
  return rendered.saveAsync({
    compress: 0.78,
    format: SaveFormat.JPEG,
  });
}

export async function createEquipment(input: NewEquipmentInput) {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };
  const { data: item, error: itemError } = await supabase
    .from('equipment_items')
    .insert({
      activity_type_id: input.activityTypeId,
      can_share: input.canShare,
      condition: input.condition,
      name: input.name.trim(),
      owner_id: input.userId,
      quantity: input.quantity,
    })
    .select('id, name, condition, quantity, can_share, activity_type_id')
    .single();
  if (itemError) return { data: null, error: itemError.message };

  let photoPath: string | null = null;
  if (input.photoUri) {
    try {
      const prepared = await preparePhoto(input.photoUri);
      const imageData = await fetch(prepared.uri).then((response) => response.arrayBuffer());
      photoPath = `${input.userId}/${item.id}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('equipment-photos')
        .upload(photoPath, imageData, {
          contentType: 'image/jpeg',
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { error: photoError } = await supabase.from('equipment_photos').insert({
        equipment_item_id: item.id,
        storage_path: photoPath,
      });
      if (photoError) throw photoError;
    } catch (error) {
      if (photoPath) {
        await supabase.storage.from('equipment-photos').remove([photoPath]);
      }
      await supabase.from('equipment_items').delete().eq('id', item.id);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'The equipment photo could not be uploaded.',
      };
    }
  }

  return {
    data: await mapEquipment({ ...item, equipment_photos: photoPath ? [{ storage_path: photoPath }] : [] }),
    error: null,
  };
}

export async function deleteEquipment(item: EquipmentItem) {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.from('equipment_items').delete().eq('id', item.id);
  if (error) return { error: error.message };

  if (item.photoPath) {
    // The database row is the source of truth. A failed best-effort storage
    // cleanup must not make a successfully deleted item reappear in the UI.
    await supabase.storage.from('equipment-photos').remove([item.photoPath]);
  }
  return { error: undefined };
}
