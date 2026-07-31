import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase',
    'migrations',
    '202607300016_last_initial_display_names.sql',
  ),
  'utf8',
);

describe('last initial display-name migration', () => {
  it('stores only one optional initial rather than a full last name', () => {
    expect(migration).toContain('add column if not exists last_initial text');
    expect(migration).toContain('char_length(last_initial) = 1');
    expect(migration).not.toContain('last_name');
  });

  it('centralizes the privacy-safe display format', () => {
    expect(migration).toContain(
      'create or replace function private.member_display_name',
    );
    expect(migration).toContain(
      "else ' ' || upper(left(trim(requested_last_initial), 1)) || '.'",
    );
  });

  it('updates all major member-name pathways', () => {
    for (const functionName of [
      'list_host_join_requests',
      'list_catch_mates',
      'list_direct_catch_proposals',
      'list_compatible_open_people',
      'list_catch_match_notifications',
      'list_catch_participant_profiles',
      'get_participant_profile',
      'list_message_threads',
      'list_thread_messages',
      'list_direct_message_threads',
      'list_direct_messages',
      'push_proposal_revision',
      'push_proposal_status',
      'push_join_request',
      'push_direct_message',
    ]) {
      expect(migration).toContain(
        `create or replace function private.${functionName}`,
      );
    }
  });
});
