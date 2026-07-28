# Security, privacy, moderation, and location

## Threat model

The highest-risk data is the link between an adult's identity, routine, and
location. The main abuse cases are stalking through repeated availability,
private-address disclosure, blocked-user rediscovery, message harassment,
impersonation, false public accusations, age-gate bypass, and notification
content leaking sensitive details.

## Location model

- Profiles store a display label and coarse search point/geohash.
- Public venues may store exact coordinates because they are already public.
- Private catches expose only a broad area before confirmation.
- Exact instructions are stored separately from discovery records and returned
  only through an authorization-checked function to hosts and confirmed participants.
- Public APIs never serialize exact private location columns.
- Private location access should be logged and automatically revoked when a
  participant leaves, is removed, or becomes blocked.
- Lock-screen notifications use text such as “Catch location updated” and never
  include an address.
- Exact residential coordinates are not required for standing availability.

The current implementation encrypts each private meeting payload with pgcrypto.
Its application key is generated and retained in Supabase Vault. A
security-definer database function checks that the caller is the host or an
approved participant before decrypting the payload; discovery and pending join
requests receive only the Catch's broad area label.

Catch Mates deliberately does not expose a searchable user or email directory.
Members can save someone after sharing an approved Catch, or exchange a
single-use, expiring friend code out of band. Direct proposals require an
existing saved relationship and respect blocks in both directions.

Open to Catch uses an active, expiring listing as the consent gate for visible
people cards. Saved availability can privately generate a Catch alert without
making that person's routine visible. Matching uses broad weekday/time labels
and a broad area; alerts never serialize private addresses.

PostGIS provides accurate radius queries and spatial indexes. The tradeoff is
additional local setup and careful safe-view design; it is justified because
distance discovery is core. Coarse search points should be deliberately rounded
or snapped before storage.

## Authentication and secrets

- Supabase manages passwords and sessions.
- The mobile client uses only the publishable project key.
- Session persistence uses a supported native storage adapter; production can
  move refresh-token storage to SecureStore if the Supabase adapter contract permits.
- Email verification and password reset deep links use the `catch://` scheme.
- `.env` is ignored. CI and EAS secrets are injected by environment.
- Database service-role keys, map secret keys, and signing credentials never use
  `EXPO_PUBLIC_` variables.

## Authorization invariants

1. A block in either direction behaves as a mutual visibility wall.
2. Pending joiners cannot read participant-only messages or private locations.
3. Only the latest proposal revision can be accepted.
4. Participant capacity is checked transactionally on approval.
5. Ratings require a completed shared catch and cannot be submitted for oneself.
6. Athletic ratings are omitted unless the rated user enables visibility.
7. 21+ labels require the actor's 21+ affirmation.
8. Catch completion, cancellation, and no-show changes create audit events.

## Moderation

Users can report a user, message, catch, or venue using structured categories,
an optional private description, and evidence references. Reports are never
public. Moderation actions have actor, reason, time, target, and expiration.

A single no-show allegation creates a disputed reliability event, not a severe
public penalty. Repeated verified events can reduce a coarse reliability label.
Free-text public accusations are not supported.

Blocking must:

- remove both users from discovery;
- reject new proposals and join requests;
- hide private profile details;
- prevent direct and catch-thread messaging between the pair;
- revoke private-location access when safely possible;
- preserve evidence needed for active moderation cases.

## Launch work required

- Independent RLS and abuse-case review.
- Privacy policy, terms, community standards, and account-deletion flow.
- Moderator access controls and audit logging.
- Data retention/deletion schedule.
- Rate limits for auth, discovery, proposals, messages, reports, and invites.
- App-store age rating and alcohol-reference review.
- Incident response and urgent safety escalation process.
