import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase',
    'migrations',
    '202607300015_profile_photo_read_fix.sql',
  ),
  'utf8',
);

describe('profile photo read fix', () => {
  it('authorizes photo reads through a security-definer helper', () => {
    expect(migration).toContain(
      'create or replace function private.can_read_profile_photo',
    );
    expect(migration).toContain('security definer');
    expect(migration).toContain('if owner_id = caller_id then');
    expect(migration).toContain('profile.photo_path = requested_object_name');
  });

  it('keeps direct-message authorization private behind the helper', () => {
    expect(migration).toContain(
      'private.can_direct_message(caller_id, owner_id)',
    );
    expect(migration).toContain(
      'grant execute on function private.can_read_profile_photo(text)',
    );
  });

  it('uses only the scoped helper in the storage read policy', () => {
    const policy = migration.slice(
      migration.indexOf('create policy "connected members can read profile photos"'),
      migration.indexOf(
        'revoke all on function private.can_read_profile_photo',
      ),
    );
    expect(policy).toContain('private.can_read_profile_photo(name)');
    expect(policy).not.toContain('private.can_direct_message');
  });
});
