# Delivery roadmap

## Implemented in this iteration

### Phase 0 — workspace and architecture

- Expo/TypeScript foundation and conventions.
- Product, architecture, schema, privacy, and roadmap documentation.
- Environment validation and demo-mode boundary.
- Initial Supabase migration and fictional seed data.
- Testable domain policies.

### Phase 1 — app shell and design foundation

- Mobile navigation with a prominent Create destination.
- Brand theme and reusable components.
- Seeded Home, Discover, Create, Messages, and Profile experiences.
- Authentication entry screens and age affirmation.
- Empty, loading, and error-state components.
- Responsive, accessible phone layouts.

## In progress

### Phase 2 — profiles and onboarding

Supabase account creation, email login, session persistence, logout, and initial
profile onboarding are connected. First name, broad area, favorite activities,
discovery radius, optional 21+ affirmation, broad recurring availability, and
equipment persist to Supabase. Equipment supports optional compressed camera or
photo-library images in a private owner-scoped Storage bucket. Remaining work is
profile photo upload, expanded privacy settings, account deletion, and
additional contextual permissions.

### Phase 3 — venues and location

PostGIS, public/custom/private/decide-later creation, encrypted private details,
and approval-gated private-location access are implemented. Remaining work is
true radius filtering, a production map adapter and pin picker, geocoding,
private-location access audit events, and dedicated access-policy tests.

### Phase 4 — creation

Catch Now and scheduled Catch forms now persist activity, start time, duration,
public venue, capacity, approval preference, intensity, age gate, and
description. Hosts can review, edit, and cancel their plans from My Catches.
Both timelines now use one Create a Catch flow, with Catch Now retained as an
urgent preset rather than a separate workflow.
Hosts can also enter a custom activity, exact date/time, duration, or unlisted
public place/general area. Remaining work is Open to Catch publishing,
activity-specific metadata beyond the custom label, shared venue submission and
geocoding, and cancellation audit events.

### Phase 5 — discovery and proposals

Live list discovery, join requests, transactional host approval, and protected
location release are implemented. Saved Catch Mates, private friend codes, and
direct proposals with immutable first revisions are also implemented; accepting
a proposal creates an unlisted two-person Catch. Remaining work is compatibility
scoring, map mode, counter-proposal revisions, external invitations, and
low-density notifications.

### Phase 6 — messages and notifications

Realtime proposal/catch threads, system messages, push token lifecycle,
notification preferences, deep links, and privacy-safe notification copy.

### Phase 7 — completion and reputation

Completion/cancellation/no-show flows, reliability events, rating eligibility,
athletic-rating visibility, equipment/venue reviews, and Catch Cards.

### Phase 8 — safety and moderation

End-to-end blocking, structured reports, evidence preservation, moderator tools,
rate limiting, location-security review, and abuse-case testing.

### Phase 9 — polish and validation

Accessibility audit, device matrix, performance, offline behavior, analytics
events, beta operations, store assets, release builds, and MVP walkthrough.

## MVP boundaries

No payments, subscriptions, ads, alcohol commerce, formal leagues, tournament
brackets, advanced verification, video, livestreams, generic social feed,
followers, complex gamification, global athletic leaderboards, or tokens.

## Future product opportunities

- **Catch+**: advanced filters, recurring availability, enhanced Catch Cards,
  personal history, organizer tools, and incognito discovery.
- Equipment partnerships and sporting-goods recommendations.
- Promoted catches and verified venue tools.
- Official meetups, brewery events, community competitions, and **Adult Field Day**.
- Optional enhanced organizer verification; foundational safety remains free.

## Analytics contract

Use a typed, provider-neutral sink for: account/onboarding/profile completion;
availability and catch creation; proposals and join requests; messages;
completion/cancellation/no-show; ratings; invites; notification opens; first and
repeat completed catches; time to first proposal/completion; compatible-activity
rate; broad regional density; completion rate; and post-completion retention.

Do not integrate a heavy analytics SDK until consent, privacy, and product needs
justify one.

## Known limitations

- Phase 1 data is local and fictional.
- Authentication, initial profile onboarding, availability, equipment, and
  private equipment-photo uploads are connected when Supabase credentials and
  migrations are configured. Catch Now and scheduled Catch creation and host
  management are also connected. Profile photos, account deletion, and Open to
  Catch publishing remain deferred.
- The private-spot form accepts an exact address or meeting instructions and the
  database supports encrypted coordinates, but the visual drop-pin picker and
  geocoding wait on a production map provider.
- Discovery currently filters by broad visibility and time, not geographic
  distance; the "within 10 miles" label remains aspirational until safe PostGIS
  radius queries are connected.
- Map, push, realtime, and moderation operations are interfaces or schema
  foundations, not production integrations.
- Native device and app-store validation require external accounts and hardware.
