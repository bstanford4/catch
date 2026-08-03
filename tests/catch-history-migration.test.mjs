import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase',
    'migrations',
    '202608020019_unified_catch_history.sql',
  ),
  'utf8',
);

describe('Unified Catch History migration', () => {
  it('includes completed Catches the caller hosted or joined', () => {
    expect(migration).toContain("target.status = 'completed'");
    expect(migration).toContain('target.host_id = caller_id');
    expect(migration).toContain("membership.status in ('approved', 'attended')");
  });

  it('summarizes the original album instead of copying media', () => {
    expect(migration).toContain('from public.catch_media memory');
    expect(migration).toContain('from public.catch_media preview');
    expect(migration).not.toMatch(/insert\s+into\s+public\.catch_media/i);
  });

  it('keeps private locations broad and respects blocks in crew names', () => {
    expect(migration).toContain("'Private meetup · ' || target.area_label");
    expect(migration).not.toContain('private_location_secrets');
    expect(migration).toContain('from public.blocks block');
  });

  it('is available only to authenticated members', () => {
    expect(migration).toContain('from public, anon');
    expect(migration).toContain('to authenticated');
    expect(migration).toContain("raise exception 'Authentication required'");
  });
});
