import { describe, expect, it } from 'vitest';

import { notificationPath } from './notification-utils';

describe('notificationPath', () => {
  it('accepts an internal Catch route', () => {
    expect(notificationPath({ path: '/matches' })).toBe('/matches');
  });

  it('rejects external and protocol-relative destinations', () => {
    expect(notificationPath({ path: 'https://example.com' })).toBeNull();
    expect(notificationPath({ path: '//example.com' })).toBeNull();
    expect(notificationPath({ path: '/\\example.com' })).toBeNull();
  });

  it('rejects missing and non-string destinations', () => {
    expect(notificationPath({})).toBeNull();
    expect(notificationPath({ path: 42 })).toBeNull();
  });
});
