import { describe, expect, it } from 'vitest';

import {
  messageTimestamp,
  normalizeMessageBody,
  validateMessageBody,
} from '../src/services/message-utils';

describe('message composition', () => {
  it('trims accidental whitespace without changing internal line breaks', () => {
    expect(normalizeMessageBody('  Bring the blue glove.\r\nMeet by field two.  ')).toBe(
      'Bring the blue glove.\nMeet by field two.',
    );
  });

  it('rejects empty and oversized messages', () => {
    expect(validateMessageBody('   ')).toBe('Write a message first.');
    expect(validateMessageBody('a'.repeat(2001))).toBe(
      'Messages must be 2,000 characters or fewer.',
    );
    expect(validateMessageBody('See you there.')).toBeNull();
  });
});

describe('message timestamps', () => {
  const now = new Date('2026-07-28T20:00:00-04:00');

  it('uses a time for messages sent today', () => {
    expect(messageTimestamp('2026-07-28T18:15:00-04:00', now)).toBe('6:15 PM');
  });

  it('uses friendly labels for earlier messages', () => {
    expect(messageTimestamp('2026-07-27T18:15:00-04:00', now)).toBe('Yesterday');
    expect(messageTimestamp('2026-07-20T18:15:00-04:00', now)).toBe('Jul 20');
  });
});
