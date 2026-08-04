# Slice 0001 — walking skeleton

**Tier** — foundation-risk

## Goal

Prove the locked architecture end-to-end: create an empty group on device, persist it locally, mint a real access token, merge to remote Postgres, wake via Realtime, fetch back — with nothing else of the product yet.

## Now → After

| | Now | After |
| --- | --- | --- |
| App | empty repo | Expo RN + Expo Router at repo root |
| Local store | none | per-group Legend observable ↔ SQLite |
| Secrets | none | `device_user_id` + access token in Secure Store |
| Server | empty `splitnext-v3` | `groups` + token table, deny-all RLS |
| Edge | none | `create-group`, `merge`, `fetch`, `rt-jwt` |
| Wake | none | Realtime private channel; wake → fetch |
| UI | none | Lobby → Create → Group hub with sync proof |

## Plan

1. Scaffold Expo (Router, TypeScript) at repo root; add Legend State, expo-sqlite, expo-secure-store, supabase-js; wire env to `splitnext-v3`.
2. Init `supabase/`; migration for `groups` + access-token table (hash only); deny-all RLS for `anon`/authenticated client roles.
3. Deploy Edge Functions: `create-group` (mint token + insert group), `merge` (versioned upsert), `fetch` (by id), `rt-jwt` (short-lived channel JWT); merge publishes wake after write.
4. Client: durable `device_user_id`; Lobby Create → local group observable + persist; call `create-group`; store token; enqueue/flush group via `merge`; subscribe with `rt-jwt`; on wake call `fetch` and apply if `remote.version > local.version`.
5. Group hub route: show group id, name (empty ok), local version, and sync status (local-only / merged / fetched).
6. Vitest seam for version compare + flush-order helper; typecheck; demo on phone via Expo Go.

## Acceptance

- Run `npx expo start`, open on phone with Expo Go: Lobby → Create group → Group hub shows the group and reaches a “on server” (or equivalent) sync state without errors.
- Killing and reopening the app still shows the group (SQLite hydrate).
- Row visible in remote `groups` for that id; token row stores only a hash.
- `vitest` covers version accept/reject symmetry; `tsc` clean.

## Out of scope

- Members, binds, assumed member, expenses, allocations — parked (core value)
- Invites / deep links / join — parked (core value / breadth)
- Activity feed — parked (breadth)
- Realtime inline payloads, polling, whole-group LWW — rejected by direction
- Design-system polish beyond readable defaults — parked (polish)
- Close/reopen, settle-up, balances UI — parked

## Parked this session

- Missed-wake detection — foundation-risk
- Multi-install recovery — foundation-risk
- Invite rate limits — foundation-risk
- Full ledger / balances / settle-up / binds — core value
- Invite URL path + deep-link hosting — breadth
- Activity feed, member detail, settings chrome — breadth
- Expense note required/optional, retention policy — breadth
- Telemetry, design-system pass, handoff checklist — polish
