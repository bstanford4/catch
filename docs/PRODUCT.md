# Product specification

## Summary

Catch helps adults arrange short, casual recreational activities with nearby
people. The product is activity-first: users see things they can do, not a deck
of people to judge. It supports three complementary intents:

1. **Catch Now** — find something in the next few hours.
2. **Post a Catch** — create a specific scheduled activity.
3. **Open to Catch** — publish coarse, expiring standing availability.

The primary validation question is whether users complete real catches with
people they would not otherwise have played with.

## Audience and eligibility

- Adults 18 and older.
- Beginners, experienced players, women, men, and nonbinary users.
- People seeking low-commitment play rather than leagues or fitness tracking.
- Alcohol-related labels are secondary and visible only to affirmed 21+ users.

## MVP outcomes

A user can onboard, choose activities, add equipment and availability, browse
nearby catches and people, create any of the three catch intents, coordinate in
context, protect private locations, complete or cancel a catch, submit eligible
ratings, and block or report abuse.

## Experience principles

- Activity before profile browsing.
- Creation should take less effort than organizing a group text.
- Seeded content and strong empty states make low-density areas useful.
- Exact private addresses are never discovery data.
- Reputation rewards reliability without public shaming.
- Humor supports trust; it never replaces clear safety language.
- Permission prompts appear at the moment a feature needs them.

## Phase 1 navigation

- **Home** — nearby scheduled catches, Catch Now requests, and Open to Catch people.
- **Discover** — filterable activity-first list, with a future map view.
- **Create** — a prominent center action for Catch Now, Post a Catch, and Open to Catch.
- **Messages** — proposal and catch threads, including system events.
- **Profile** — identity, equipment, availability, privacy, Catch Card, and settings.

Creation is a primary tab rather than a floating action that can conflict with
screen-reader order or device safe areas.

## Assumptions

- The initial build uses fictional data centered on a generic northern Virginia
  demo area; no precise home addresses are included.
- Email and password are the first auth method; social providers remain an
  extension point.
- List discovery ships before map discovery. A map adapter prevents provider
  lock-in.
- PostGIS `geography(Point, 4326)` is appropriate for public venues and coarse
  search points; private address material is isolated and encrypted outside
  ordinary discovery tables.
- Athletic ratings are opt-in visibility and catch-specific filtering only.
- A report is private moderation data. Public free-text accusations do not exist.
- Standing availability expires and needs reconfirmation.
- Demo mode is a first-class development capability, not a production fallback.

## External prerequisites

None are needed for the seeded demo. Later phases require:

- A Supabase project and client-safe project URL/publishable key.
- EAS/Apple/Google developer accounts for native builds and push credentials.
- A selected map provider account only when the map implementation is enabled.
- App-store privacy disclosures, terms, and moderation support procedures before launch.

## Non-blocking decisions for later

- Launch community and initial geographic concentration.
- Google Maps versus Mapbox after cost and styling review.
- Final moderation service-level targets and operator tooling.
- Whether 21+ affirmation is stored as a boolean or verified birth date. The MVP
  uses an affirmation and intentionally avoids collecting birth dates.

