# Overview

Last updated: slice 0010

## Direction

**Destination** — A mobile app for splitting shared costs among a small group of friends: groups, members, expenses, derived balances, and settle-up suggestions. Records and suggests; never moves money.

**Users** — People on a trip or shared activity who need a running tally of who paid and who owes whom. Members are name-slots, not login identities. Someone can be on the ledger without installing the app.

**Constraints** —
- No user accounts (capability tokens prove access)
- Local-first / full offline, entity-level merge sync
- Stack: Expo React Native, Expo Router, Legend State, expo-sqlite, Supabase Postgres + Edge Functions + Realtime (wake-only)
- Remote Supabase project `splitnext-v3` (`ycpkguwfxlhpovnsuujr`, eu-central-1)
- Access tokens in `expo-secure-store`
- Dev/demo: physical phone + Expo Go; `npm run web` runs the whole app in a browser for testing and screenshots
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
- Sync split into flush / apply / subscribe modules behind a `groupSync` facade; typed clearable errors; queue identity by `entity_type + id + version` — [slice 0004](slices/0004-sync-quality-harden.md)
- Record an expense against the member who paid — integer cents, listed on the hub, synced through the same merge path — [slice 0005](slices/0005-expense-spine.md)
- Choose which member you are, and change that choice, until the group's first expense fixes it — [slice 0005](slices/0005-expense-spine.md)
- Run the whole app in a browser (`npm run web`), which is what makes headless end-to-end runs and board screenshots possible — [slice 0006](slices/0006-web-target.md)
- Split every expense equally across the members live at record time, frozen into the expense, identical on every device — [slice 0007](slices/0007-allocations-balances.md)
- See each member's net position on the hub — paid minus owed, most-negative first, You (Name) marked — [slice 0007](slices/0007-allocations-balances.md)
- Reopen a group with several expenses without the screen crashing on revived `Date` timestamps — [slice 0007](slices/0007-allocations-balances.md)
- Record a clip per flow and stills for the board with `npm run capture`, driving the real app against the deployed Edge Functions — [slice 0007](slices/0007-allocations-balances.md)
- Work the repo from any clone: the loop is vendored at `.claude/skills/`, `AGENTS.md` is the entry point, CI enforces the gates — [slice 0008](slices/0008-repo-home.md)
- Read the board and use the app as URLs, both published by CI on every merge, with code chips linking to GitHub — [slice 0008](slices/0008-repo-home.md)
- Read the symbol map two ways — flat by area, or as a tree nested under what calls what, derived from the source — [slice 0009](slices/0009-symbol-tree.md)
- Trust that what is on `main` is what is on the server — merge pushes migrations, redeploys every Edge Function, and fails unless each answers with that merge's sha — [slice 0010](slices/0010-deploy-pipeline.md)

## Stack

- Client — Expo RN 57 + Expo Router — mobile-first; web is a real second target, used for headless testing and board screenshots
- UI state — Legend State v3 (`useValue`, per-group observable) — UI source of truth
- Local durability — `expo-sqlite` kv-store via `observablePersistSqlite` + `configureObservableSync` — write-through persist; web swaps the plugin for `localStorage` (`persistPlugin.web.ts`) because expo-sqlite's web path is wasm over OPFS, which headless Chromium cannot run
- Secrets — `expo-secure-store` behind `src/secrets/secureStorage.ts` — `device_user_id`, `access_token.{groupId}`; lobby id list also there for now (temporary). Web has no keychain and falls back to `localStorage`
- Server DB — Supabase Postgres — `groups`, `access_tokens`, `members`, `binds`, `expenses` (with `allocations jsonb`); deny-all RLS
- Server API — Edge Functions `create-group`, `merge`, `fetch-entity`, `list-roster`, `rt-jwt` — capability hash-check then service role; each answers `GET ?health=1` with the deploy sha (L-efHealth)
- Wake channel — Realtime broadcast on `group:{id}`; payload is tip only; `rt-jwt` gates subscribe (anon_channel fallback — D-006)
- Hosting — remote `splitnext-v3` — D-001
- Server deploy — `.github/workflows/supabase.yml` on every merge to `main`: `db push`, stamp `DEPLOY_SHA`, deploy all five functions, verify each health endpoint; never by hand — D-052, D-053
- Repo — `github.com/santistebanc/splitnext-app`, public; a slice is branch → PR (CI: `npm run check`) → squash merge → tag `slice-NNNN` on `main` — D-028
- Board — regenerated by CI and published to https://santistebanc.github.io/splitnext-app/ on every merge to `main`; its path chips link to the file on GitHub, and to the editor when served locally
- Board tooling — Python under `docs/scripts/`; the Symbols call graph is derived from source by `callgraph.py` and gated by `npm run test:board` in CI — D-034, D-037
- Live app — the static web export ships to https://santistebanc.github.io/splitnext-app/app/ from the same workflow, linked from the board's topbar — D-031
- Agent entry point — `AGENTS.md` + the process vendored at `.claude/skills/{slicer,tdd,code-review,prototype}`, so a clone carries the loop — D-029

## Data model

**Group** — `id`, `version`, `updated_at`, `deleted_at`, `name`, `currency_label`, `is_closed`. Client UUID v4; merge when `incoming.version > stored.version`.

**Member** — `id`, `group_id`, `display_name`, `version`, `updated_at`, `deleted_at`. Name-slot; not a login. Soft-delete only (UI for delete/rename parked).

**Bind** — `id`, `group_id`, `device_user_id`, `member_id`, `version`, `updated_at`, `deleted_at`. Active bind = assumed member. Unique: one active bind per device per group — re-choosing re-points that bind at a higher version rather than adding a second.

**Expense** — `id`, `group_id`, `payer_member_id`, `amount_cents`, `description`, `allocations`, `version`, `updated_at`, `deleted_at`. Integer cents only. `allocations` is `[{ member_id, amount_cents }]` carried *inside* the expense (jsonb server-side), so one version number covers the whole split and a merge can never take a new amount while rejecting a share. Optional on the type: expenses recorded before slice 0007 carry none, and balances treat that as "payer credited, nobody debited".

**Balance** (derived, never stored) — per live member, Σ paid − Σ owed across live expenses, sorted most-negative first.

**Access token** — server: `token_hash`, `group_id`, `device_user_id`, `revoked_at`. Client holds plaintext in Secure Store. One per device per group.

**Outbound queue** (client) — per-group `{ entity_type, id, version, payload }` on the Legend store; flushed to `merge` in flush order. Auto-flushed on open/foreground via `syncGroup`.

## Routes / surfaces

| Route | What it does | Shipped in |
| --- | --- | --- |
| `/` | Lobby: create group, list local group ids; root AppState sync | slice 0001 / 0002 |
| `/group/[id]` | Hub: members list, add, This is me (open until the first expense), You (Name); balances (net per member, signed); expenses list + add, each row saying how many ways it split; bump sync proof; open → syncGroup | slice 0001–0007 |

## Seams

- `shouldAcceptVersion` / `sortByFlushOrder` — `src/domain/version.ts` — vitest
- `shouldAttemptFlush` / `queueAfterMergeResults` — `src/sync/queuePolicy.ts` — vitest
- `assumedMemberIdFromBinds` / `bindingIsOpen` — `src/domain/assumedMember.ts` — vitest
- Edge Functions behind `src/api/edge.ts` — the HTTP capability boundary; the place a fake would go if one comes back
- `syncError` / `coerceSyncError` — `src/sync/syncErrors.ts` — vitest
- `getSecret` / `setSecret` — `src/secrets/secureStorage.ts` — the platform split for secrets; a fake here replaces the keychain
- `persistPlugin` — `src/store/persistPlugin.ts` — the platform split for durability
- `splitEqually` — `src/domain/split.ts` — vitest
- `computeBalances` — `src/domain/balances.ts` — vitest
- `normalizePersistedTimestamps` — `src/store/timestamps.ts` — vitest — the one place persisted shape is repaired on open
- `npm run capture` — `docs/scripts/capture-flows.mjs` — drives the web target through every flow in `FLOWS.md`, asserting a clean console and balances that survive a reload
- `isHealthRequest` / `healthPayload` — `supabase/functions/_shared/health.ts` — vitest — the deploy provenance probe
- `evaluate` — `docs/scripts/verify_deploy.py` — unittest via `npm run test:board` — pass/fail for "is the server this commit?"
