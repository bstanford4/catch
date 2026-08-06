import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase',
    'migrations',
    '202608050021_private_direct_proposal_locations.sql',
  ),
  'utf8',
);

describe('private direct-proposal locations migration', () => {
  it('encrypts exact proposal locations with the existing Vault-backed key', () => {
    expect(migration).toContain('add column if not exists private_location_encrypted bytea');
    expect(migration).toContain('extensions.pgp_sym_encrypt');
    expect(migration).toContain('private.catch_location_key()');
  });

  it('does not return encrypted or exact details in pending proposal lists', () => {
    const listFunction = migration.match(
      /create function private\.list_direct_catch_proposals\(\)[\s\S]+?\n\$\$;/,
    )?.[0];
    expect(listFunction).toBeTruthy();
    expect(listFunction).toContain('revision.location_type');
    expect(listFunction).not.toContain('private_location_encrypted');
    expect(listFunction).not.toContain('exact_address');
  });

  it('copies the encrypted details only when the recipient accepts', () => {
    expect(migration).toContain("if revision_row.location_type = 'private' then");
    expect(migration).toContain('insert into public.private_location_secrets');
    expect(migration).toContain('revision_row.private_location_encrypted');
    expect(migration).toContain("'location_type', revision_row.location_type");
  });

  it('keeps venue, later, and private proposal shapes mutually exclusive', () => {
    expect(migration).toContain("location_type in ('later', 'catalog', 'private')");
    expect(migration).toContain(
      "location_type = 'private' and venue_id is null and private_location_encrypted is not null",
    );
  });
});
