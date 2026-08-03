# Catch

Catch is an activity-first mobile app for adults who want to find someone nearby
for a casual, low-commitment recreational activity.

The app includes a polished seeded demo plus live Supabase-backed authentication,
profile onboarding, broad availability, equipment management, Catch Now and
scheduled Catch creation, live discovery, join requests, host approval, and
protected private meeting locations. Catch Mates adds saved connections,
single-use private friend codes, and direct Catch proposals. Open to Catch adds
persistent opt-in listings, day-specific recurring availability, compatible-person
explanations, and in-app alerts for newly posted matching Catches. Contextual
messaging adds private proposal and Catch threads, unread counts, system
updates, and live Realtime refresh. Notification settings add account-wide
category controls, device-token lifecycle, privacy-safe deep links, and
automatic Expo push dispatch. Hosts can confirm that a past Catch happened,
opening a private Catch Memories album where approved crew members can add
photos or short videos later and remove their own uploads. Catch Highlights lets
uploaders explicitly share individual photos from completed public Catches with
signed-in members; uploads default to private, videos stay private, names are
separately opt-in, and reports hide a photo pending review. It runs without credentials in demo mode and
establishes the product shell, navigation, design system, account
creation and sign-in, discovery feed, creation flow, messages, profile,
empty/loading/error states, and backend boundaries needed for later phases.

## Stack

- React Native and Expo SDK 57
- TypeScript and Expo Router
- Supabase Auth, Postgres, Storage, and Realtime (adapter included; credentials optional)
- Vitest for domain logic
- ESLint and TypeScript for static checks

## Quick start

Prerequisites:

- Node.js 20 or newer
- npm
- Expo Go matching the selected SDK, or an Android/iOS development build

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run start
```

The app deliberately falls back to realistic demo data when Supabase variables
are absent.

## Commands

```powershell
npm.cmd run start
npm.cmd run android
npm.cmd run ios
npm.cmd run web
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
```

## Environment

Copy `.env.example` to `.env`. Variables beginning with `EXPO_PUBLIC_` are
embedded in the client and must never contain a service-role key or any other
secret.

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client-safe Supabase publishable key |
| `EXPO_PUBLIC_MAP_PROVIDER` | Reserved map adapter selection; defaults to `mock` |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | Expo EAS project ID used to issue native push tokens |

## Documentation

- [Product and assumptions](docs/PRODUCT.md)
- [Architecture, flows, schema, and folder structure](docs/ARCHITECTURE.md)
- [Security, privacy, moderation, and location](docs/SECURITY_PRIVACY.md)
- [Phased roadmap, scope, and future opportunities](docs/ROADMAP.md)
- [Supabase setup and migrations](supabase/README.md)

## Current scope

Phase 0 and Phase 1 are implemented. Phase 2 authentication, initial profile
onboarding, broad availability, and equipment are connected: account creation,
email confirmation, sign-in, persisted sessions, sign-out, first name, broad
area, activity preferences, discovery radius, 21+ affirmation, persistent
day-and-time availability windows, equipment records, and private compressed equipment photos
use Supabase when credentials are present. Hosts can create, edit, review, and
cancel persisted Catch Now and scheduled plans. Signed-in users can discover
live Catches, request to join, and receive host approval. Public places, custom
public places, decide-later locations, and encrypted private spots are supported;
exact private details are released only to the host and approved participants.
Catch Mates can save approved co-participants or connect known friends through a
private code without exposing a searchable member directory. Accepted direct
proposals create unlisted two-person Catches. Open to Catch matches shared
activities, broad availability, and broad area; saved preferences privately
generate in-app Catch alerts. Signed-in members can coordinate inside proposal
threads and approved Catch conversations without exposing those messages to
unrelated users. Members can edit notification categories, register or revoke a
native device, and open the correct in-app screen from privacy-safe push alerts.
Production maps and app-store releases remain deferred. Native push requires an
Expo/EAS-linked native build and platform credentials; it does not run in the
web preview.
Completed Catch crews can keep a private long-term album and optionally publish
permission-confirmed photos to the signed-in Catch Highlights community view.
A unified Catch History lists completed Catches a member hosted or joined and
opens those same original albums, so photos are never uploaded twice.
See the roadmap for details.

Catch creation includes flexible "Other" options for a custom activity,
date/time, duration, and public-place name/general area. Custom places are stored
on that Catch rather than silently added to the shared venue catalog. Private
spots use a separate encrypted database record and an approval-gated access
function. Catch Now and scheduled posting share one Create a Catch form; urgent
shortcuts simply preselect a near-term start while the backend retains the
internal kind needed for expiration and discovery.
