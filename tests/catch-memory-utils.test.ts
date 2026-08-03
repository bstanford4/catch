import { describe, expect, it } from 'vitest';

import {
  MAX_CATCH_MEMORY_VIDEO_BYTES,
  validateCatchMemoryAsset,
} from '../src/services/catch-memory-utils';

describe('Catch Memory uploads', () => {
  it('accepts photos without applying video limits', () => {
    expect(validateCatchMemoryAsset({ fileSize: 100_000_000, type: 'image' })).toBeNull();
  });

  it('limits videos to one minute', () => {
    expect(
      validateCatchMemoryAsset({ durationMilliseconds: 60_001, type: 'video' }),
    ).toContain('60 seconds');
    expect(
      validateCatchMemoryAsset({ durationMilliseconds: 60_000, type: 'video' }),
    ).toBeNull();
  });

  it('limits videos to 50 MB', () => {
    expect(
      validateCatchMemoryAsset({
        fileSize: MAX_CATCH_MEMORY_VIDEO_BYTES + 1,
        type: 'video',
      }),
    ).toContain('50 MB');
  });
});
