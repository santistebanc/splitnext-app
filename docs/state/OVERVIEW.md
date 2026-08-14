# Overview

Last updated: slice 0024

## Direction

**Destination** — A mobile app for splitting shared costs among a small group of friends: groups, members, expenses, derived balances, and settle-up suggestions. Records and suggests; never moves money.

**Users** — People on a trip or shared activity who need a running tally of who paid and who owes whom. Members are name-slots, not login identities. Someone can be on the ledger without installing the app.

**Constraints** —
- No user accounts (capability tokens prove access)
- Local-first / full offline, entity-level merge sync
- Stack: Expo React Native, Expo Router, Legend State, expo-sqlite, Cloudflare Worker + one SQLite Durable Object per group + D1 token/invite index
- Remote Worker `splitnext` at `https://splitnext.santistebanc94.workers.dev` (D1 `splitnext-index`)
- Access tokens in `expo-secure-store`
- Dev/demo: physical phone + Expo Go; `npm run web` runs the whole app in a browser for testing and screenshots
- Money as integer cents; version (not timestamps) for conflicts; soft-delete only
- Device floor iOS 16+ / Android 12+; English-only; light-only UI
- Clients never talk to D1 or the Durable Object; the Worker is the only door, after a capability hash-check
- Slice quality: thin scope, high craft inside the slice (seams + TDD + review); speed ≠ skip quality

**Non-goals** — User accounts / OAuth, payment rails, contact import / social graphs, accounting / OCR / budgets / recurring bills, behavioural analytics, push notifications, marketing site, OTA updates, full CRDT sync frameworks, dedicated sync platforms (ElectricSQL, PowerSync, Replicache), group-wide invite UI (MVP), close/reopen UI (MVP)

## Capabilities

- Create an empty group on device, mint a per-device access token, persist locally, sync the group entity to the server — [slice 0001](slices/0001-walking-skeleton.md)
- Open a group hub: balance list (You highlighted, Invite / This is me chips), All expenses, FAB + Expense once bound; bump name still there until settings — [slice 0001](slices/0001-walking-skeleton.md) / [slice 0023](slices/0023-member-first-hub-chrome.md)
- Reopen groups after app kill from SQLite + Secure Store lobby index — [slice 0001](slices/0001-walking-skeleton.md)
- Auto-flush outbound queue + thin inbound group fetch on group open and app foreground (all lobby groups) — [slice 0002](slices/0002-queue-auto-flush.md)
- Add name-slot members, bind this device to one (assumed member), show You (Name) on hub; roster list-pull on open/foreground — [slice 0003](slices/0003-members-binds.md)
- Sync split into flush / apply / subscribe modules behind a `groupSync` facade; typed clearable errors; queue identity by `entity_type + id + version` — [slice 0004](slices/0004-sync-quality-harden.md)
- Record an expense against the member who paid — integer cents, listed under All expenses, synced through the same merge path — [slice 0005](slices/0005-expense-spine.md) / [slice 0023](slices/0023-member-first-hub-chrome.md)
- Choose which member you are, and change that choice, until the group's first expense fixes it — [slice 0005](slices/0005-expense-spine.md)
- Run the whole app in a browser (`npm run web`), which is what makes headless end-to-end runs and board screenshots possible — [slice 0006](slices/0006-web-target.md)
- Split every expense equally across the members chosen at record time (default everyone live), frozen into the expense, identical on every device — [slice 0007](slices/0007-allocations-balances.md) / [slice 0018](slices/0018-expense-form.md)
- Choose who paid and who shares on a dedicated new-expense screen; default is You paid and everyone shares — [slice 0018](slices/0018-expense-form.md)
- See each member's net position on the hub — paid minus owed, most-negative first, You (Name) marked — [slice 0007](slices/0007-allocations-balances.md) / [slice 0023](slices/0023-member-first-hub-chrome.md)
- See a member's expenses as paid-for and owe-for lines that add up to their net — [slice 0024](slices/0024-member-expense-buckets.md)
- See the fewest transfers that zero those nets on a member's screen (the ones they would pay); derived, identical on every device, never moves money — [slice 0017](slices/0017-settle-up.md) / [slice 0023](slices/0023-member-first-hub-chrome.md)
- Tap a settle button to open the new-expense form already filled for that transfer; saving records it, the tap does not — [slice 0019](slices/0019-settle-prefill.md) / [slice 0023](slices/0023-member-first-hub-chrome.md)
- Leave a group from You-detail: this device is unbound and its token is revoked; the member and expenses stay — slice 0025
- Reopen a group with several expenses without the screen crashing on revived `Date` timestamps — [slice 0007](slices/0007-allocations-balances.md)
- Record a clip per flow and stills for the board with `npm run capture`, driving the real app against the deployed Worker; CI asserts those same flows against a local Worker without rewriting the clips — [slice 0007](slices/0007-allocations-balances.md) / [slice 0022](slices/0022-capture-ci.md)
- Work the repo from any clone: the loop is vendored at `.claude/skills/`, `AGENTS.md` is the entry point, CI enforces the gates — [slice 0008](slices/0008-repo-home.md)
- Read the board and use the app as URLs, both published by CI on every merge, with code chips linking to GitHub — [slice 0008](slices/0008-repo-home.md)
- Read the symbol map two ways — flat by area, or as a tree nested under what calls what, derived from the source — [slice 0009](slices/0009-symbol-tree.md)
- Trust that what is on `main` is what is on the server — merge applies D1 migrations, redeploys the Worker, and fails unless every route answers with that merge's sha — [slice 0010](slices/0010-deploy-pipeline.md)
- Catch up a group whose wake socket died while the hub stayed open — the client retries the socket, then runs the same flush + roster pull as open, for that group only — [slice 0011](slices/0011-missed-wake.md) / [slice 0016](slices/0016-wake-reconnect.md)
- Invite another device onto a named member; they redeem a one-use 7-day link and land already bound — [slice 0012](slices/0012-member-invites.md)
- Demo an unmerged slice against the same Worker the published app uses: `slice/**` CI deploys there; last green run wins; never a wipe — [slice 0013](slices/0013-dev-remote.md)
- Scan a Camera QR on the PR comment to open the published web app on a phone — [slice 0013](slices/0013-dev-remote.md)
- Talk to one Cloudflare Worker: SQLite Durable Object per group, D1 for tokens and invites, hibernating WebSocket wakes — [slice 0014](slices/0014-cloudflare-do.md)
- Fail a PR when a Worker HTTP shape drifts: `npm test` boots a local Worker and drives `src/api/edge.ts` through every `FUNCTIONS` route — [slice 0020](slices/0020-worker-contract.md)
- Fail a PR when the wake tip or `/wake/` auth drifts: same local Worker, WebSocket contract — [slice 0021](slices/0021-wake-contract.md)
- Fail a PR when a recorded flow breaks: CI boots a local Worker and `npm run web`, then drives capture `--assert-only` — [slice 0022](slices/0022-capture-ci.md)

## Stack

- Client — Expo RN 57 + Expo Router — mobile-first; web is a real second target, used for headless testing and board screenshots
- UI state — Legend State v3 (`useValue`, per-group observable) — UI source of truth
- Local durability — `expo-sqlite` kv-store via `observablePersistSqlite` + `configureObservableSync` — write-through persist; web swaps the plugin for `localStorage` (`persistPlugin.web.ts`) because expo-sqlite's web path is wasm over OPFS, which headless Chromium cannot run
- Secrets — `expo-secure-store` behind `src/secrets/secureStorage.ts` — `device_user_id`, `access_token.{groupId}`; lobby id list also there for now (temporary). Web has no keychain and falls back to `localStorage`
- Group store — SQLite Durable Object per `group_id` — `groups`, `members`, `binds`, `expenses` (allocations as JSON text); one-threaded merge, no race
- Token index — D1 `splitnext-index` — `access_tokens`, `invites` only (`token_hash → group_id`)
- Server API — Worker routes `create-group`, `merge`, `fetch-entity`, `list-roster`, `mint-invite`, `join-group`, `leave-group` — capability hash-check then the named Durable Object; each answers `GET ?health=1` with the deploy sha (L-efHealth). `npm test` boots the same Worker locally and drives those routes through `src/api/edge.ts` (D-070), plus the wake WebSocket wire (D-071)
- Wake channel — hibernating WebSocket on the group Durable Object at `/wake/:groupId`; payload is tip only; a drop is retried with backoff, then `OPEN` after `ERROR` / `CLOSED` runs the same catch-up as open (D-054, D-066); joiners subscribe on the hub, not the join spinner. Auth + tip shape are contract-tested against a local Worker.
- Hosting — Cloudflare Worker `splitnext` (`splitnext.santistebanc94.workers.dev`)
- Server deploy — `.github/workflows/workers.yml` on push to `main` or `slice/**`: D1 migrations apply, `wrangler deploy` with `DEPLOY_SHA`, verify each health endpoint; last green run wins; never by hand, never a wipe — D-052, D-058
- Repo — `github.com/santistebanc/splitnext-app`, public; a slice is branch → PR (CI: `check` + `capture`) → squash merge → tag `slice-NNNN` on `main` — D-028, D-072
- Board — regenerated by CI and published to https://santistebanc.github.io/splitnext-app/ on every merge to `main`; its path chips link to the file on GitHub, and to the editor when served locally. The current slice is a separate page generated per PR, not a tab on that board (D-055)
- Board tooling — Python under `docs/scripts/`; the Symbols call graph is derived from source by `callgraph.py` and gated by `npm run test:board` in CI — D-034, D-037
- Live app — the static web export ships to https://santistebanc.github.io/splitnext-app/app/ from the same workflow, linked from the board's topbar — D-031
- Agent entry point — `AGENTS.md` + the process vendored at `.claude/skills/{slicer,tdd,code-review,prototype}`, so a clone carries the loop — D-029

## Data model

**Group** — `id`, `version`, `updated_at`, `deleted_at`, `name`, `currency_label`, `is_closed`. Client UUID v4; merge when `incoming.version > stored.version`.

**Member** — `id`, `group_id`, `display_name`, `version`, `updated_at`, `deleted_at`. Name-slot; not a login. Soft-delete only (UI for delete/rename parked).

**Bind** — `id`, `group_id`, `device_user_id`, `member_id`, `version`, `updated_at`, `deleted_at`. Active bind = assumed member. Unique: one active bind per device per group — re-choosing re-points that bind at a higher version rather than adding a second.

**Expense** — `id`, `group_id`, `payer_member_id`, `amount_cents`, `description`, `allocations`, `version`, `updated_at`, `deleted_at`. Integer cents only. `allocations` is `[{ member_id, amount_cents }]` carried *inside* the expense (JSON text in the Durable Object), so one version number covers the whole split and a merge can never take a new amount while rejecting a share. Split equally across the members selected at record time (default all live); the payer need not be in that set (D-068). Optional on the type: expenses recorded before slice 0007 carry none, and balances treat that as "payer credited, nobody debited".

**Balance** (derived, never stored) — per live member, Σ paid − Σ owed across live expenses, sorted most-negative first.

**Member buckets** (derived, never stored) — per live member, the live expenses they touched as paid-for and owe-for lines. One line per expense; amount is their net on that expense; the lines sum to their balance. Paid-for names the other live allocated members; owe-for names the payer (D-074).

**Settlement** (derived, never stored) — the fewest transfers that zero those nets: `{ from_member_id, to_member_id, amount_cents }`. Zero-sum subgroups, then poorest↔richest inside each; unmatched leftover omitted. A member screen shows that person's outgoing transfers after the buckets; a tap opens the new-expense form; the tap does not move money (D-067, D-069, D-073).

**Access token** — server: `token_hash`, `group_id`, `device_user_id`, `revoked_at`. Client holds plaintext in Secure Store. One per device per group.

**Invite** — server only, not a merge entity: `token_hash`, `group_id`, `member_id`, `expires_at`, `redeemed_at`. One-use, 7-day. Redeeming mints an access token and a v1 bind for that member. Plaintext is shown once at mint.

**Outbound queue** (client) — per-group `{ entity_type, id, version, payload }` on the Legend store; flushed to `merge` in flush order. Auto-flushed on open, foreground, and wake-socket reconnect via `syncGroup`.

## Routes / surfaces

| Route | What it does | Shipped in |
| --- | --- | --- |
| `/` | Lobby: create group, paste-to-join, list local group ids; root AppState sync | slice 0001 / 0002 / 0012 |
| `/join` | Redeem an invite token from the URL; opens the hub already bound | slice 0012 |
| `/group/[id]` | Hub: one balance list (You highlighted; Invite on everyone who isn't You; This is me while binding is open); add member; All expenses →; FAB + Expense once bound; bump leftover; typed sync error; open → syncGroup | slice 0001–0007 / 0012 / 0017 / 0018 / 0019 / 0023 |
| `/group/[id]/member/[memberId]` | Member: paid-for / owe-for buckets, net, settle buttons, Leave group on You | slice 0023 / 0024 / 0025 |
| `/group/[id]/expenses` | All expenses, newest first | slice 0023 |
| `/group/[id]/expense/new` | New expense: payer, amount, description, who shares (equal among selected; default You paid, everyone shares; query can prefill) | slice 0018 / 0019 |

## Seams

- `shouldAcceptVersion` / `sortByFlushOrder` — `src/domain/version.ts` — vitest
- `shouldAttemptFlush` / `queueAfterMergeResults` — `src/sync/queuePolicy.ts` — vitest
- `assumedMemberIdFromBinds` / `bindingIsOpen` — `src/domain/assumedMember.ts` — vitest
- `tombstoneBind` — `src/domain/bind.ts` — vitest — soft-delete a live bind at the next version
- Worker routes behind `src/api/edge.ts` — vitest against a local Worker (`createTestHarness` + D1 migrations), never `workers.dev` — the HTTP capability boundary. Wake WebSocket at `/wake/:groupId` is the same harness: auth + tip after merge. `leave-group` revokes the token (D-075).
- `syncError` / `coerceSyncError` — `src/sync/syncErrors.ts` — vitest
- `getSecret` / `setSecret` / `deleteSecret` — `src/secrets/secureStorage.ts` — the platform split for secrets; a fake here replaces the keychain
- `persistPlugin` — `src/store/persistPlugin.ts` — the platform split for durability
- `splitEqually` / `participantsForSplit` — `src/domain/split.ts` — vitest
- `computeBalances` — `src/domain/balances.ts` — vitest
- `suggestSettlements` / `settlementsForMember` — `src/domain/settle.ts` — vitest
- `memberBuckets` — `src/domain/buckets.ts` — vitest — one member's paid-for / owe-for lines; they sum to that member's net
- `formatCents` / `formatMoney` / `memberLabel` — `src/ui/format.ts` — integer cents as decimal text; You (Name)
- `colors` — `src/ui/theme.ts` — prototype palette
- `expensePrefillFromSearchParams` / `settlementHref` — `src/domain/expensePrefill.ts` — vitest
- `normalizePersistedTimestamps` — `src/store/timestamps.ts` — vitest — the one place persisted shape is repaired on open
- `npm run capture` — `docs/scripts/capture-flows.mjs` — drives the web target through every flow in `FLOWS.md`, asserting a clean console and balances that survive a reload. `--assert-only` skips writing clips. CI runs that against a local Worker (`npm run capture:ci`).
- `balancesOf` / `settleOf` / `settleRowOf` / `balanceRowOf` / `paidForOf` / `owesForOf` — `docs/scripts/capture-driver.mjs` — unittest via `npm run test:board` for the extractors; capture drives the locators
- `parseCaptureArgv` / `contextOptions` — `docs/scripts/capture-opts.mjs` — unittest via `npm run test:board` — whether this run records video
- `assertLocalOrigin` / `metroEnv` / `isDeployedWorkerUrl` / `webPortOccupied` — `docs/scripts/local-origin.mjs` — unittest via `npm run test:board` — the web bundle talks to the listen origin, not `workers.dev`
- `jobs` / `job_text` / `secret_names` — `docs/scripts/ci_gates.py` — unittest via `npm run test:board` — `check` stays the four fast gates; the `capture` job has no Cloudflare secrets
- `isHealthRequest` / `healthPayload` — `workers/src/health.ts` — vitest — the deploy provenance probe
- `evaluate` — `docs/scripts/verify_deploy.py` — unittest via `npm run test:board` — pass/fail for "is the server this commit?"
- `target_for` / `github_output` — `docs/scripts/deploy_target.py` — unittest via `npm run test:board` — which GitHub event may deploy to Worker `splitnext`, and that it may never wipe
- `inviteIsLive` / `parseInviteToken` / `joinPathForToken` — `src/domain/invite.ts` — vitest (`src/domain/invite.test.ts`)
- `inviteShareText` — `src/sync/inviteShareText.ts` / `src/sync/inviteShareText.web.ts` — raw token on native, `/join?token=` URL on web
- `shouldCatchUpOnStatus` / `shouldReplaceSubscription` / `nextReconnectDelayMs` — `src/sync/wakePolicy.ts` — vitest — whether a wake-socket status change means this group missed wakes, whether a dead socket should be replaced, and how long to wait before retrying
- `wakeUrl` — `src/sync/wakeUrl.ts` — vitest — query-string token on `/wake/:groupId`; RN `WebSocket` cannot set headers
- `phone_section` — `docs/scripts/pr_phone.py` — unittest via `npm run test:board` — the PR comment's Camera QR of the published `/app`
