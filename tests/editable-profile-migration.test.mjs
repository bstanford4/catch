import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase',
    'migrations',
    '202607300014_editable_profile_photos.sql',
  ),
  'utf8',
);

describe('editable profile photo migration', () => {
  it('keeps profile photos in a private, size-limited bucket', () => {
    expect(migration).toContain("'profile-photos'");
    expect(migration).toContain('false,');
    expect(migration).toContain('5242880');
  });

  it('limits uploads and deletion to the photo owner', () => {
    expect(migration).toContain(
      "(storage.foldername(name))[1] = (select auth.uid()::text)",
    );
    expect(migration).toContain('on storage.objects for insert to authenticated');
    expect(migration).toContain('on storage.objects for delete to authenticated');
  });

  it('allows reads only for the owner or an authorized connection', () => {
    expect(migration).toContain(
      'private.can_direct_message(',
    );
    expect(migration).toContain(
      'create policy "connected members can read profile photos"',
    );
  });

  it('updates editable fields atomically without accepting another owner path', () => {
    expect(migration).toContain('create or replace function private.update_my_profile');
    expect(migration).toContain(
      "split_part(requested_photo_path, '/', 1) <> caller_id::text",
    );
    expect(migration).toContain('delete from public.user_activity_preferences');
    expect(migration).toContain(
      'insert into public.user_activity_preferences',
    );
  });
});
