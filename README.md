# Catch

Catch is an activity-first mobile app for adults who want to find someone nearby
for a casual, low-commitment recreational activity.

The Phase 1 build is a polished, seeded Expo demo. It runs without external
accounts and establishes the product shell, navigation, design system,
authentication entry points, discovery feed, creation flow, messages, profile,
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

## Documentation

- [Product and assumptions](docs/PRODUCT.md)
- [Architecture, flows, schema, and folder structure](docs/ARCHITECTURE.md)
- [Security, privacy, moderation, and location](docs/SECURITY_PRIVACY.md)
- [Phased roadmap, scope, and future opportunities](docs/ROADMAP.md)
- [Supabase setup and migrations](supabase/README.md)

## Current scope

Phase 0 and Phase 1 are implemented. Supabase project provisioning, native push
credentials, production maps, and app-store releases require external accounts
and are intentionally deferred. See the roadmap for phase details and known
limitations.

