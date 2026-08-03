import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase',
    'migrations',
    '202608020018_public_catch_highlights.sql',
  ),
  'utf8',
);

describe('Public Catch Highlights migration', () => {
  it('keeps uploads private and permits only attested photos to become public', () => {
    expect(migration).toContain("visibility text not null default 'private'");
    expect(migration).toContain("media_type = 'photo'");
    expect(migration).toContain('consent_attested_at is not null');
    expect(migration).toContain('permission_attested');
    expect(migration).toContain("raise exception 'Videos remain private'");
  });

  it('limits highlights to completed public Catches at public places', () => {
    expect(migration).toContain("target.status = 'completed'");
    expect(migration).toContain("target.visibility = 'public'");
    expect(migration).toContain("in ('catalog', 'custom_public')");
  });

  it('serves the feed only to signed-in members and respects blocks', () => {
    expect(migration).toContain('to authenticated');
    expect(migration).toContain('from public, anon');
    expect(migration).toContain('from public.blocks block');
    expect(migration).toContain('Catch members can read public highlight objects');
  });

  it('uses opt-in participant credits and hides reported photos', () => {
    expect(migration).toContain('create table if not exists public.catch_highlight_credits');
    expect(migration).toContain('create table if not exists public.catch_media_reports');
    expect(migration).toContain("set moderation_status = 'hidden'");
    expect(migration).toContain('Per-Catch opt-in for displaying a participant name');
  });
});
