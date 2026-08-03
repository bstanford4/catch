export const MAX_CATCH_MEMORY_VIDEO_SECONDS = 60;
export const MAX_CATCH_MEMORY_VIDEO_BYTES = 50 * 1024 * 1024;

export type CatchMemoryAssetSummary = {
  durationMilliseconds?: number | null;
  fileSize?: number | null;
  type?: 'image' | 'video' | null;
};

export function validateCatchMemoryAsset(asset: CatchMemoryAssetSummary) {
  if (asset.type !== 'video') return null;
  if (
    asset.durationMilliseconds &&
    asset.durationMilliseconds > MAX_CATCH_MEMORY_VIDEO_SECONDS * 1000
  ) {
    return `Choose a video that is ${MAX_CATCH_MEMORY_VIDEO_SECONDS} seconds or shorter.`;
  }
  if (asset.fileSize && asset.fileSize > MAX_CATCH_MEMORY_VIDEO_BYTES) {
    return 'Choose a video smaller than 50 MB.';
  }
  return null;
}
