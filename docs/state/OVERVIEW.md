# Overview

Last updated: slice 0004

## Direction

**Destination** — A mobile app for splitting shared costs among a small group of friends: groups, members, expenses, derived balances, and settle-up suggestions. Records and suggests; never moves money.

**Users** — People on a trip or shared activity who need a running tally of who paid and who owes whom. Members are name-slots, not login identities. Someone can be on the ledger without installing the app.

**Constraints** —
- No user accounts (capability tokens prove access)
- Local-first / full offline, entity-level merge sync
- Stack: Expo React Native, Expo Router, Legend State, expo-sqlite, Supabase Postgres + Edge Functions + Realtime (wake-only)
- Remote Supabase project `splitnext-v3` (`ycpkguwfxlhpovnsuujr`, eu-central-1)
- Access tokens in `expo-secure-store`
- Dev/demo: physical phone + Expo Go
- Money as integer cents; version (not timestamps) for conflicts; soft-delete only
- Device floor iOS 16+ / Android 12+; English-only; light-only UI
- Clients never talk to Postgres; deny-all RLS; Edge Functions use service role after capability hash-check
- Slice quality: thin scope, high craft inside the slice (seams + TDD + review); speed ≠ skip quality

**Non-goals** — User accounts / OAuth, payment rails, contact import / social graphs, accounting / OCR / budgets / recurring bills, behavioural analytics, push notifications, marketing site, OTA updates, full CRDT sync frameworks, dedicated sync platforms (ElectricSQL, PowerSync, Replicache), group-wide invite UI (MVP), close/reopen UI (MVP)

## Capabilities

- Create an empty group on device, mint a per-device access token, persist locally, sync group entity to Postgres — [slice 0001](slices/0001-walking-skeleton.md)
- Open a group hub showing id, name, version, and sync status; bump name via merge + wake + fetch — [slice 0001](slices/0001-walking-skeleton.md)
- Reopen groups after app kill from SQLite + Secure Store lobby index — [slice 0001](slices/0001-walking-skeleton.md)
- Auto-flush outbound queue + thin inbound group fetch on group open and app foreground (all lobby groups) — [slice 0002](slices/0002-queue-auto-flush.md)
- Add name-slot members, bind this device to one (assumed member), show You (Name) on hub; roster list-pull on open/foreground — [slice 0003](slices/0003-members-binds.md)
- Sync split into flush / apply / subscribe modules behind a `groupSync` facade; typed clearable errors; queue identity by `entity_type + id + version`; a test per flow — [slice 0004](slices/0004-sync-quality-harden.md)

## Stack

- Client — Expo RN 57 + Expo Router — mobile-first; web secondary (SQLite web alpha)
- UI state — Legend State v3 (`useValue`, per-group observable) — UI source of truth
- Local durability — `expo-sqlite` kv-store via `observablePersistSqlite` + `configureObservableSync` — write-through persist
- Secrets — `expo-secure-store` — `device_user_id`, `access_token.{groupId}`; lobby id list also there for now (temporary)
- Server DB — Supabase Postgres — `groups`, `access_tokens`, `members`, `binds`; deny-all RLS
- Server API — Edge Functions `create-group`, `merge`, `fetch-entity`, `list-roster`, `rt-jwt` — capability hash-check then service role
- Wake channel — Realtime broadcast on `group:{id}`; payload is tip only; `rt-jwt` gates subscribe (anon_channel fallback — D-006)
- Hosting — remote `splitnext-v3` — D-001

## Data model

**Group** — `id`, `version`, `updated_at`, `deleted_at`, `name`, `currency_label`, `is_closed`. Client UUID v4; merge when `incoming.version > stored.version`.

**Member** — `id`, `group_id`, `display_name`, `version`, `updated_at`, `deleted_at`. Name-slot; not a login. Soft-delete only (UI for delete/rename parked).

**Bind** — `id`, `group_id`, `device_user_id`, `member_id`, `version`, `updated_at`, `deleted_at`. Active bind = assumed member. Unique: one active bind per device per group.

**Access token** — server: `token_hash`, `group_id`, `device_user_id`, `revoked_at`. Client holds plaintext in Secure Store. One per device per group.

**Outbound queue** (client) — per-group `{ entity_type, id, version, payload }` on the Legend store; flushed to `merge` in flush order. Auto-flushed on open/foreground via `syncGroup`.

## Routes / surfaces

| Route | What it does | Shipped in |
| --- | --- | --- |
| `/` | Lobby: create group, list local group ids; root AppState sync | slice 0001 / 0002 |
| `/group/[id]` | Hub: members list, add, This is me, You (Name); bump sync proof; open → syncGroup | slice 0001–0003 |

## Seams

- `shouldAcceptVersion` / `sortByFlushOrder` — `src/domain/version.ts` — vitest
- `shouldAttemptFlush` / `queueAfterMergeResults` — `src/sync/queuePolicy.ts` — vitest
- `assumedMemberIdFromBinds` / `deviceHasActiveBind` — `src/domain/assumedMember.ts` — vitest
- Edge Functions behind `src/api/edge.ts` — HTTP capability boundary; faked there by the flow tests
- `flushQueue` / `applyRemoteFetch` / `pullRoster` / `startWakeSubscription` — `src/sync/` — flow tests (`src/flows/F-*.flow.test.ts`)
- `syncError` / `coerceSyncError` — `src/sync/syncErrors.ts` — vitest
