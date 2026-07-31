import { describe, expect, it } from 'vitest';

import {
  formatMemberName,
  memberInitials,
  normalizeLastInitial,
} from '../src/utils/member-name';

describe('privacy-safe member names', () => {
  it('formats an optional last initial without requiring a full last name', () => {
    expect(formatMemberName('Blake', 's')).toBe('Blake S.');
    expect(formatMemberName('Blake', '')).toBe('Blake');
  });

  it('normalizes the field to one uppercase character', () => {
    expect(normalizeLastInitial(' stanford')).toBe('S');
    expect(normalizeLastInitial(null)).toBe('');
  });

  it('uses the last initial in avatar initials', () => {
    expect(memberInitials('Blake S.')).toBe('BS');
    expect(memberInitials('Blake')).toBe('BL');
  });
});
