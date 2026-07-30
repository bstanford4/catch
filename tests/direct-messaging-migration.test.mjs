import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase',
    'migrations',
    '202607290012_safe_direct_messages.sql',
  ),
  'utf8',
);

describe('safe direct-message migration', () => {
  it('protects every direct-message table with row-level security', () => {
    expect(migration).toContain(
      'alter table public.direct_message_threads enable row level security',
    );
    expect(migration).toContain(
      'alter table public.direct_messages enable row level security',
    );
    expect(migration).toContain(
      'alter table public.direct_message_thread_reads enable row level security',
    );
  });

  it('requires an existing relationship and respects blocks', () => {
    expect(migration).toContain(
      'not private.users_blocked(requested_user_id, requested_other_id)',
    );
    expect(migration).toContain('from public.catch_mates mate');
    expect(migration).toContain('from public.catches shared');
  });

  it('routes push notifications back into the direct conversation', () => {
    expect(migration).toContain("'path', '/message/direct/'");
    expect(migration).toContain("'threadType', 'direct'");
    expect(migration).toContain("'messages'");
  });
});
