# Supabase setup

The local Expo demo does not require Supabase. To enable the backend:

1. Create a Supabase project.
2. Install the Supabase CLI or use the dashboard SQL editor.
3. Apply migrations in timestamp order.
4. Run `seed.sql` for catalog and public-venue demo records.
5. Copy `.env.example` to `.env` and add the project URL and client-safe
   publishable key.
6. Add `catch://**` to the project's Auth redirect URLs.
7. Restart Expo so client environment variables are rebundled.

With the CLI:

```powershell
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase db reset
```

`db reset` is destructive and should be used only against a local development
database.

## Seed model

The SQL seed covers activity catalogs and fictional public venues. Rich fictional
user/catch/proposal/message/rating data lives in `src/data/demo.ts` so Phase 1 is
useful without manufacturing rows in `auth.users`. When Phase 2 connects Auth,
the same fixtures will be moved into an authenticated development seed script.

## Security note

RLS is enabled in the initial migration. The included policies are a foundation,
not a substitute for a launch security review. In particular, private location
decryption should happen in a trusted server function after participant
authorization and should create an access audit event.

