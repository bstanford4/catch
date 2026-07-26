# Supabase setup

The local Expo demo does not require Supabase. To enable the backend:

1. Create a Supabase project.
2. Install the Supabase CLI or use the dashboard SQL editor.
3. Open **SQL Editor**, create a new query, paste
   `migrations/202607240001_initial_schema.sql`, and run it once.
4. In a new query, paste
   `migrations/202607250002_equipment_storage.sql`, and run it once. This creates
   the private, owner-scoped equipment photo bucket and its Storage RLS policies.
5. Run `seed.sql` for catalog and public-venue demo records.
6. Copy `.env.example` to `.env` and add the project URL and client-safe
   publishable key.
7. Add `catch://**` to the project's Auth redirect URLs.
8. Restart Expo so client environment variables are rebundled.

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
not a substitute for a launch security review. In particular, private location
decryption should happen in a trusted server function after participant
authorization and should create an access audit event.
