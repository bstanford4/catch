import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase',
    'migrations',
    '202607300013_participant_profiles.sql',
  ),
  'utf8',
);

describe('participant-profile privacy migration', () => {
  it('requires an approved connection before returning a profile', () => {
    expect(migration).toContain(
      'private.can_direct_message(caller_id, requested_user_id)',
    );
    expect(migration).toContain(
      "caller_membership.status in ('approved', 'attended')",
    );
    expect(migration).toContain(
      "participant.status in ('approved', 'attended')",
    );
  });

  it('enforces blocks while listing the Catch crew', () => {
    expect(migration).toContain(
      'not private.users_blocked(caller_id, profile.user_id)',
    );
  });

  it('does not return direct contact, age, or exact-location fields', () => {
    const returnShape = migration.slice(
      migration.indexOf('create or replace function private.get_participant_profile'),
      migration.indexOf('language plpgsql', migration.indexOf(
        'create or replace function private.get_participant_profile',
      )),
    );
    expect(returnShape).not.toContain('email');
    expect(returnShape).not.toContain('age_');
    expect(returnShape).not.toContain('coarse_location');
    expect(returnShape).not.toContain('exact');
    expect(returnShape).not.toContain('photo_path');
  });
});
