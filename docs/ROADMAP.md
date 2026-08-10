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
editable first name, bio, activities, and private profile photos are now
implemented. An optional last initial distinguishes members without collecting
full last names. Explicitly shareable equipment now includes its authorized photo
on connected participant profiles; unshared gear remains owner-only. Remaining
work is expanded privacy settings, account deletion, and additional contextual
permissions.

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
public place/general area. Remaining work is activity-specific metadata beyond
the custom label, shared venue submission and geocoding, and cancellation audit
events. Open and full Catches now expire automatically after their scheduled
duration; confirmed Catches remain available for the future completion flow.

### Phase 5 — discovery and proposals

Live list discovery, join requests, transactional host approval, and protected
location release are implemented. Saved Catch Mates, private friend codes, and
direct proposals with immutable first revisions are also implemented. A sender
can keep an accepted proposal to two people or make it discoverable with a total
crew limit; every additional person still requests access and requires host
approval before joining or seeing an exact private location. Persistent Open to Catch listings
now show compatible people using shared activities, day-specific broad availability,
and area; newly posted Catches create matching in-app alerts. Remaining work is
distance-weighted scoring, map mode, counter-proposal revisions, external
invitations and push-delivery operations.

### Phase 6 — messages and notifications

Realtime proposal/Catch threads, safe one-to-one Catch Mate messages,
privacy-scoped participant profiles, unread state, and contextual system
messages are implemented. Editable notification
preferences, native Expo token
registration/revocation, preference-aware database event delivery, safe deep
links, privacy-safe lock-screen copy, participant/date context in the inbox, and
automatic closing of expired Catch threads are implemented. Remaining work is
EAS credential provisioning, native-device validation, Expo receipt processing,
stale-token cleanup, and notification analytics.

### Phase 7 — completion and reputation

Host-confirmed completion and private participant-only Catch Memories are now
implemented. Completed crews can add photos or short videos immediately or
weeks later, while uploaders retain deletion control. Signed-in Catch Highlights
is also implemented as an opt-in proof-of-play view: individual photos from
completed public Catches at public places can be shared with permission, names
are separately opt-in, videos remain private, and reports hide photos pending
review. Unified Catch History now combines completed Catches a member hosted or
joined, with crew names, private-safe location labels, album counts, and previews
from the original media records. This is deliberately not a generic follower/content feed.
A uniform, editable post-Catch review is now available for planned, impromptu,
and retroactive Catches. Every confirmed participant is prompted to review every
other confirmed participant, Catch History supports later updates, raw responses
remain private, and eligible structured ratings update the member's own scouting
report. Privacy-thresholded Catch Mate scouting reports are also visible to
connected members after reviews from at least three distinct people; raw answers
and private notes remain private. New planned and impromptu Catches now use the
same private, editable attendance check: members confirm themselves before
rating, may report who else attended, and a single no-show report never changes
someone's public reputation. Remaining work is reliability-event adjudication,
scheduled reminder delivery, athletic-rating visibility, equipment/venue
reviews, and shareable Catch Cards.
Reviewers can also send a separate optional note to the person they reviewed.
It is private to the recipient by default; the recipient may hide it or feature
the quote anonymously on their profile. Reviewer-only notes and raw scores remain
private and are never converted into profile content.

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

- **Catch+**: advanced filters, calendar exceptions and syncing, enhanced Catch Cards,
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
- Authentication, initial profile onboarding, availability, equipment, private
  equipment-photo uploads, Catch creation/management, Open to Catch matching,
  and contextual messaging are connected when Supabase credentials and
  migrations are configured. Profile photos and account deletion remain
  deferred.
- The private-spot form accepts an exact address or meeting instructions and the
  database supports encrypted coordinates, but the visual drop-pin picker and
  geocoding wait on a production map provider.
- Discovery currently filters by broad visibility and time, not geographic
  distance; the "within 10 miles" label remains aspirational until safe PostGIS
  radius queries are connected.
- Push is integrated through Expo's API but needs an EAS-linked native build and
  platform credentials before device validation. Delivery receipts and automatic
  stale-token cleanup are not yet implemented. Map and moderation operations
  remain foundations. Realtime is currently limited to active message threads.
- Native device and app-store validation require external accounts and hardware.
