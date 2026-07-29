# Supabase setup

The local Expo demo does not require Supabase. To enable the backend:

1. Create a Supabase project.
2. Install the Supabase CLI or use the dashboard SQL editor.
3. Open **SQL Editor**, create a new query, paste
   `migrations/202607240001_initial_schema.sql`, and run it once.
4. In a new query, paste
   `migrations/202607250002_equipment_storage.sql`, and run it once. This creates
   the private, owner-scoped equipment photo bucket and its Storage RLS policies.
5. Run `migrations/202607250003_repair_activity_emoji.sql` once. It safely repairs
   activity emoji if the seed was copied through a legacy Windows text encoding.
6. Run `migrations/202607260004_private_locations_and_join_requests.sql` once.
   It adds discovery policies, encrypted private-location functions, join
   requests, and transactional host approval.
7. Run `migrations/202607260005_catch_mates_and_direct_proposals.sql` once.
   It adds saved Catch Mates, single-use friend codes, and direct proposals that
   become real unlisted Catches when accepted.
8. Run `migrations/202607270006_open_to_catch_matching.sql` once. It adds
   opt-in Open to Catch publishing, privacy-safe compatible-person matching,
   and in-app alerts for newly posted compatible Catches.
9. Run `migrations/202607270007_persistent_open_availability.sql` once. It makes
   Open to Catch and day-specific recurring availability persistent until the
   member edits, clears, or pauses them.
10. Run `migrations/202607280008_security_advisor_hardening.sql` once. It
    revokes unnecessary Data API access to the project-owned RLS event function
    and optimizes Catch's RLS policies. PostGIS-owned findings require Supabase
    Support or a backed-up extension reinstall.
11. Run `seed.sql` for catalog and public-venue demo records.
12. Copy `.env.example` to `.env` and add the project URL and client-safe
   publishable key.
13. Add `catch://**` to the project's Auth redirect URLs.
14. Restart Expo so client environment variables are rebundled.

When copying a UTF-8 SQL file from Windows PowerShell 5.1, specify its encoding:

```powershell
Get-Content -Encoding utf8 -Raw .\supabase\seed.sql | Set-Clipboard
```

With the CLI:

```powershell
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase db reset
```

`db reset` is destructive and should be used only against a local development
database.

## Seed model

Then paste `seed.sql` into a second SQL Editor query and run it once.

The SQL seed covers activity catalogs and fictional public venues. Rich fictional
user/catch/proposal/message/rating data lives in `src/data/demo.ts` so Phase 1 is
useful without manufacturing rows in `auth.users`. When Phase 2 connects Auth,
the same fixtures will be moved into an authenticated development seed script.

## Security note

RLS is enabled in the initial migration. Data API grants are explicit because the
project is created with automatic new-table exposure disabled. The included policies are a foundation,
not a substitute for a launch security review. Private location decryption now
happens in an authorization-checked security-definer function after participant
approval. A launch hardening pass must add immutable access audit events and
rate limits.
