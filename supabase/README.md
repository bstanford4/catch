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
11. Run `migrations/202607290009_contextual_messaging.sql` once. It adds
    private proposal/Catch conversations, unread state, system messages, and
    Realtime delivery for approved thread members.
12. Run `migrations/202607290010_native_push_notifications.sql` once. It adds
    validated Expo device-token registration, a private notification outbox,
    preference-aware event triggers, and asynchronous delivery through `pg_net`.
13. Run
    `migrations/202607290011_conversation_context_and_catch_expiration.sql`
    once. It enables Supabase Cron, marks old open/full Catches expired every
    five minutes, and closes their conversations without sending a routine push.
14. Run `migrations/202607290012_safe_direct_messages.sql` once. It adds
    one-to-one messages for Catch Mates and members of a shared approved Catch,
    with mutual block enforcement, unread state, Realtime updates, and push
    notifications.
15. Run `migrations/202607300013_participant_profiles.sql` once. It adds
    privacy-scoped profiles and crew lists for approved Catch participants,
    including activities, recurring availability, and shareable-equipment
    labels without exposing email, age data, or exact locations.
16. Run `migrations/202607300014_editable_profile_photos.sql` once. It adds
    atomic profile editing and a private profile-photo bucket. Photo reads are
    limited to the owner, Catch Mates, and approved members of a shared Catch.
17. Run `migrations/202607300015_profile_photo_read_fix.sql` once. It routes
    private Storage reads through an authenticated, exact-object authorization
    helper so owners and connected participants can load signed photo URLs.
18. Run `migrations/202607300016_last_initial_display_names.sql` once. It adds
    an optional one-letter last initial and formats member names consistently
    across profiles, requests, matching, proposals, messages, and push alerts.
19. Run `migrations/202608020017_catch_completion_memories.sql` once. It adds
    host-confirmed completion and a private Catch Memories bucket for crew-only
    photos and videos up to 60 seconds. Approved participants can contribute at
    any later date and can remove their own uploads.
20. Run `migrations/202608020018_public_catch_highlights.sql` once. It adds the
    signed-in Catch Highlights feed, private-by-default per-photo sharing with a
    permission attestation, opt-in participant name credit, block filtering, and
    report-to-hide moderation. Videos and non-public locations remain private.
21. Run `migrations/202608020019_unified_catch_history.sql` once. It adds a
    private unified history for completed Catches the caller hosted or joined,
    summarizing the existing Catch Memories album without copying its media.
22. Run `migrations/202608020020_past_catches_rugby_friend_codes.sql` once. It
    adds retroactive completed Catches, Rugby catalog support, attendance
    confirmations, and the repaired reusable Catch Mate code function.
23. Run `migrations/202608050021_private_direct_proposal_locations.sql` once.
    It adds encrypted private locations to direct Catch Mate proposals. Pending
    proposals expose only the broad area; exact details unlock after acceptance.
24. Run `migrations/202608050022_post_catch_reviews.sql` once. It adds the
    uniform, editable post-Catch review form for planned, impromptu, and
    retroactive Catches, plus private raw ratings and the member's own aggregate
    scouting report.
25. Run `migrations/202608060023_shareable_equipment_photos.sql` once. It lets
    connected members see the photo attached to explicitly shareable gear while
    retaining owner-only access for every unshared item. It also adds connected
    member Catch Cards whose aggregate feedback unlocks only after reviews from
    at least three distinct people; raw ratings and notes remain private.
26. Run `migrations/202608060024_fix_shareable_equipment_photo_policy.sql` once.
    It fixes the connected-viewer photo check without changing which equipment
    is eligible to be shared.
27. Run `migrations/202608060025_attendance_and_open_direct_catches.sql` once.
    It adds private attendance/no-show confirmations for completed planned
    Catches, opt-in approval-gated discovery for accepted direct proposals, and
    recipient-controlled shared feedback that is private by default and can be
    featured anonymously on a participant profile.
28. Run `migrations/202608100026_catch_mate_invitations.sql` once. It adds
    host-managed invitations from new or edited Catches, explicit invitee
    acceptance, capacity enforcement, private-location protection, and push
    alerts using the existing proposal notification preference.
29. Run `seed.sql` for catalog and public-venue demo records.
30. Copy `.env.example` to `.env` and add the project URL and client-safe
    publishable key.
31. Add `catch://**` to the project's Auth redirect URLs.
32. Link the app to Expo EAS, put its project ID in
    `EXPO_PUBLIC_EAS_PROJECT_ID`, configure iOS/Android push credentials, and
    install a development or production build. Expo Go and the web preview
    cannot validate production push delivery.
33. Restart Expo so client environment variables are rebundled.

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

Push requests are placed in a private outbox and sent asynchronously to Expo.
The current MVP does not yet poll Expo push receipts or automatically revoke
tokens reported as unregistered; add that operational worker before launch.
