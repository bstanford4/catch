import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';

export type EditableProfile = {
  activitySlugs: string[];
  bio: string;
  firstName: string;
  photoPath: string | null;
  photoUrl: string | null;
};

export type UpdateProfileInput = {
  activitySlugs: string[];
  bio: string;
  firstName: string;
  photoUri?: string;
  previousPhotoPath: string | null;
  removeExistingPhoto: boolean;
  userId: string;
};

export async function createProfilePhotoUrl(path: string | null) {
  if (!supabase || !path) return null;
  const { data, error } = await supabase.storage
    .from('profile-photos')
    .createSignedUrl(path, 3600);
  return error ? null : (data?.signedUrl ?? null);
}

async function createOwnProfilePhotoUrl(path: string | null) {
  if (!supabase || !path) return { url: null, error: null };
  const { data, error } = await supabase.storage
    .from('profile-photos')
    .createSignedUrl(path, 3600);
  return {
    url: data?.signedUrl ?? null,
    error: error?.message ?? (!data?.signedUrl ? 'No photo URL was returned.' : null),
  };
}

export async function getMyEditableProfile(userId: string) {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };
  const [{ data: row, error }, { data: preferenceRows, error: preferenceError }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('first_name, bio, photo_path')
        .eq('user_id', userId)
        .single(),
      supabase
        .from('user_activity_preferences')
        .select('activity_type_id')
        .eq('user_id', userId),
    ]);
  if (error) return { data: null, error: error.message };
  if (preferenceError) return { data: null, error: preferenceError.message };

  const activityIds = preferenceRows?.map((item) => item.activity_type_id) ?? [];
  const { data: activityRows, error: activityError } = activityIds.length
    ? await supabase.from('activity_types').select('slug').in('id', activityIds)
    : { data: [] as { slug: string }[], error: null };
  if (activityError) return { data: null, error: activityError.message };

  const photo = await createOwnProfilePhotoUrl(row.photo_path);
  return {
    data: {
      activitySlugs: activityRows?.map((item) => item.slug) ?? [],
      bio: row.bio ?? '',
      firstName: row.first_name,
      photoPath: row.photo_path,
      photoUrl: photo.url,
    } satisfies EditableProfile,
    error: photo.error
      ? `Your photo is saved, but it could not be displayed: ${photo.error}`
      : null,
  };
}

async function preparePhoto(uri: string) {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: 1000 });
  const rendered = await context.renderAsync();
  return rendered.saveAsync({
    compress: 0.8,
    format: SaveFormat.JPEG,
  });
}

async function uploadProfilePhoto(userId: string, photoUri: string) {
  if (!supabase) return { path: null, error: 'Supabase is not configured.' };
  try {
    const prepared = await preparePhoto(photoUri);
    const imageData = await fetch(prepared.uri).then((response) => response.arrayBuffer());
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { error } = await supabase.storage.from('profile-photos').upload(path, imageData, {
      contentType: 'image/jpeg',
      upsert: false,
    });
    return error ? { path: null, error: error.message } : { path, error: null };
  } catch (error) {
    return {
      path: null,
      error: error instanceof Error ? error.message : 'The profile photo could not be uploaded.',
    };
  }
}

export async function updateMyProfile(input: UpdateProfileInput) {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };
  const firstName = input.firstName.trim();
  const bio = input.bio.trim();
  if (!firstName) return { data: null, error: 'Enter your first name.' };
  if (firstName.length > 60) {
    return { data: null, error: 'First name must be 60 characters or fewer.' };
  }
  if (bio.length > 500) return { data: null, error: 'Bio must be 500 characters or fewer.' };
  if (!input.activitySlugs.length) {
    return { data: null, error: 'Choose at least one activity.' };
  }

  let newPhotoPath: string | null = null;
  if (input.photoUri) {
    const upload = await uploadProfilePhoto(input.userId, input.photoUri);
    if (upload.error || !upload.path) {
      return { data: null, error: upload.error ?? 'The profile photo could not be uploaded.' };
    }
    newPhotoPath = upload.path;
  }

  const photoPath =
    newPhotoPath ?? (input.removeExistingPhoto ? null : input.previousPhotoPath);
  const { error } = await supabase.rpc('update_my_profile', {
    requested_activity_slugs: input.activitySlugs,
    requested_bio: bio,
    requested_first_name: firstName,
    requested_photo_path: photoPath,
  });
  if (error) {
    if (newPhotoPath) await supabase.storage.from('profile-photos').remove([newPhotoPath]);
    return { data: null, error: error.message };
  }

  if ((newPhotoPath || input.removeExistingPhoto) && input.previousPhotoPath) {
    await supabase.storage.from('profile-photos').remove([input.previousPhotoPath]);
  }

  const savedPhoto = await createOwnProfilePhotoUrl(photoPath);
  if (savedPhoto.error) {
    return {
      data: null,
      error: `Your profile was saved, but the photo could not be displayed: ${savedPhoto.error}`,
    };
  }

  return {
    data: {
      activitySlugs: input.activitySlugs,
      bio,
      firstName,
      photoPath,
      photoUrl: savedPhoto.url,
    } satisfies EditableProfile,
    error: null,
  };
}
