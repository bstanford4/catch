import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase',
    'migrations',
    '202608020017_catch_completion_memories.sql',
  ),
  'utf8',
);

describe('Catch completion and memories migration', () => {
  it('keeps albums private to completed Catch crews', () => {
    expect(migration).toContain('create table if not exists public.catch_media');
    expect(migration).toContain('private.can_access_catch_memories');
    expect(migration).toContain("target.status = 'completed'");
    expect(migration).toContain('completed crew can read Catch memories');
  });

  it('lets people add memories later without an upload deadline', () => {
    expect(migration).toContain('completed crew can add Catch memories');
    expect(migration).not.toMatch(/created_at\s*>\s*now\(\)\s*-/i);
    expect(migration).not.toMatch(/interval\s+'\d+ days'/i);
  });

  it('limits video duration and lets uploaders remove their own media', () => {
    expect(migration).toContain('duration_seconds between 1 and 60');
    expect(migration).toContain('uploaders can remove their Catch memories');
    expect(migration).toContain('uploaders can remove Catch memory objects');
  });

  it('records host-confirmed completion in status history', () => {
    expect(migration).toContain('create or replace function private.complete_catch');
    expect(migration).toContain("'host_confirmed'");
    expect(migration).toContain('public.catch_status_history');
  });
});
