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
discovery radius, and optional 21+ affirmation persist to Supabase. Remaining
work is image upload, availability, equipment, expanded privacy settings,
account deletion, and contextual permissions.

### Phase 3 — venues and location

Provision PostGIS, ship safe discovery RPCs, public/private venue flows, radius
controls, map adapter, and private-location access tests.

### Phase 4 — creation

Persist Catch Now, scheduled Catch, and Open to Catch multi-step forms with
activity-specific metadata, capacity, visibility, and 21+ gates.

### Phase 5 — discovery and proposals

Compatibility scoring, list/map modes, proposals and immutable revisions, join
requests, invitations, transactional acceptance, and low-density notifications.

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
- Authentication and initial profile onboarding are connected when Supabase
  credentials and migrations are configured. Availability, equipment, profile
  photos, and account deletion remain deferred.
- Map, push, realtime, moderation operations, and uploads are interfaces or schema
  foundations, not production integrations.
- Native device and app-store validation require external accounts and hardware.
