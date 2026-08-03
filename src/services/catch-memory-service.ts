import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';
import { validateCatchMemoryAsset } from '@/services/catch-memory-utils';

export type CatchMemory = {
  caption: string | null;
  catchId: string;
  createdAt: string;
  durationSeconds: number | null;
  height: number | null;
  id: string;
  mediaType: 'photo' | 'video';
  mimeType: string;
  moderationStatus: 'visible' | 'hidden';
  storagePath: string;
  uploaderId: string;
  uploaderName: string;
  url: string;
  visibility: 'private' | 'public';
  width: number | null;
};

export type CatchMemoryAsset = {
  duration?: number | null;
  fileSize?: number | null;
  height?: number | null;
  mimeType?: string | null;
  type?: 'image' | 'video' | null;
  uri: string;
  width?: number | null;
};

type CatchMemoryRow = {
  caption: string | null;
  catch_id: string;
  created_at: string;
  duration_seconds: number | null;
  height: number | null;
  id: string;
  media_type: 'photo' | 'video';
  mime_type: string;
  moderation_status: 'visible' | 'hidden';
  storage_path: string;
  uploader_id: string;
  uploader_name: string;
  visibility: 'private' | 'public';
  width: number | null;
};

async function signedMemoryUrl(path: string) {
  if (!supabase) return { url: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.storage
    .from('catch-memories')
    .createSignedUrl(path, 60 * 60);
  return { url: data?.signedUrl ?? null, error: error?.message ?? null };
}

export async function listCatchMemories(catchId: string) {
  if (!supabase) return { data: [] as CatchMemory[], error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('list_catch_memories', {
    requested_catch_id: catchId,
  });
  if (error) return { data: [] as CatchMemory[], error: error.message };

  const rows = (data ?? []) as CatchMemoryRow[];
  const withUrls = await Promise.all(
    rows.map(async (row) => ({ row, signed: await signedMemoryUrl(row.storage_path) })),
  );
  const urlError = withUrls.find((item) => item.signed.error)?.signed.error;
  return {
    data: withUrls
      .filter((item) => Boolean(item.signed.url))
      .map(({ row, signed }) => ({
        caption: row.caption,
        catchId: row.catch_id,
        createdAt: row.created_at,
        durationSeconds: row.duration_seconds,
        height: row.height,
        id: row.id,
        mediaType: row.media_type,
        mimeType: row.mime_type,
        moderationStatus: row.moderation_status,
        storagePath: row.storage_path,
        uploaderId: row.uploader_id,
        uploaderName: row.uploader_name,
        url: signed.url!,
        visibility: row.visibility,
        width: row.width,
      })),
    error: urlError ?? null,
  };
}

async function preparePhoto(asset: CatchMemoryAsset) {
  const context = ImageManipulator.manipulate(asset.uri);
  context.resize({ width: 1800 });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
  return {
    contentType: 'image/jpeg',
    extension: 'jpg',
    height: saved.height,
    uri: saved.uri,
    width: saved.width,
  };
}

function videoExtension(mimeType: string) {
  if (mimeType === 'video/quicktime') return 'mov';
  if (mimeType === 'video/webm') return 'webm';
  return 'mp4';
}

export async function uploadCatchMemory(input: {
  asset: CatchMemoryAsset;
  caption: string;
  catchId: string;
  uploaderId: string;
}) {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };
  const validationError = validateCatchMemoryAsset({
    durationMilliseconds: input.asset.duration,
    fileSize: input.asset.fileSize,
    type: input.asset.type,
  });
  if (validationError) return { data: null, error: validationError };

  const mediaType = input.asset.type === 'video' ? 'video' : 'photo';
  let uploadUri = input.asset.uri;
  let mimeType = input.asset.mimeType ?? (mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
  let extension = mediaType === 'video' ? videoExtension(mimeType) : 'jpg';
  let width = input.asset.width ?? null;
  let height = input.asset.height ?? null;

  try {
    if (mediaType === 'photo') {
      const prepared = await preparePhoto(input.asset);
      uploadUri = prepared.uri;
      mimeType = prepared.contentType;
      extension = prepared.extension;
      width = prepared.width;
      height = prepared.height;
    }

    const binary = await fetch(uploadUri).then((response) => response.arrayBuffer());
    const storagePath = `${input.catchId}/${input.uploaderId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${extension}`;
    const { error: storageError } = await supabase.storage
      .from('catch-memories')
      .upload(storagePath, binary, { contentType: mimeType, upsert: false });
    if (storageError) return { data: null, error: storageError.message };

    const durationSeconds =
      mediaType === 'video' && input.asset.duration
        ? Math.max(1, Math.ceil(input.asset.duration / 1000))
        : null;
    const { data, error } = await supabase
      .from('catch_media')
      .insert({
        caption: input.caption.trim() || null,
        catch_id: input.catchId,
        duration_seconds: durationSeconds,
        height,
        media_type: mediaType,
        mime_type: mimeType,
        storage_path: storagePath,
        uploader_id: input.uploaderId,
        width,
      })
      .select('id')
      .single();
    if (error || !data?.id) {
      await supabase.storage.from('catch-memories').remove([storagePath]);
      return { data: null, error: error?.message ?? 'The memory could not be saved.' };
    }
    return { data: data.id as string, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'The memory could not be uploaded.',
    };
  }
}

export async function deleteCatchMemory(memory: CatchMemory, userId: string) {
  if (!supabase) return { error: 'Supabase is not configured.' };
  if (memory.uploaderId !== userId) return { error: 'You can remove only your own memories.' };
  const { error } = await supabase
    .from('catch_media')
    .delete()
    .eq('id', memory.id)
    .eq('uploader_id', userId);
  if (error) return { error: error.message };
  const { error: storageError } = await supabase.storage
    .from('catch-memories')
    .remove([memory.storagePath]);
  return { error: storageError?.message };
}

export async function setCatchMemoryPublic(memoryId: string, isPublic: boolean) {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.rpc('set_catch_memory_public', {
    permission_attested: isPublic,
    requested_memory_id: memoryId,
    requested_public: isPublic,
  });
  return { error: error?.message };
}

export async function getMyCatchHighlightCredit(catchId: string, userId: string) {
  if (!supabase) return { data: false, error: 'Supabase is not configured.' };
  const { data, error } = await supabase
    .from('catch_highlight_credits')
    .select('catch_id')
    .eq('catch_id', catchId)
    .eq('user_id', userId)
    .maybeSingle();
  return { data: Boolean(data), error: error?.message ?? null };
}

export async function setMyCatchHighlightCredit(catchId: string, isVisible: boolean) {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.rpc('set_catch_highlight_credit', {
    requested_catch_id: catchId,
    requested_visible: isVisible,
  });
  return { error: error?.message };
}
