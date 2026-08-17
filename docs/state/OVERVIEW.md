# Overview

Last updated: slice 0030

## Direction

**Destination** — A mobile app for splitting shared costs among a small group of friends: groups, members, expenses, derived balances, and settle-up suggestions. Records and suggests; never moves money. Surfaces stay this app's (lobby, hub, member, expense form) — not a chrome rewrite of the v1 app. Product still to land: expense delete, kick, activity + toast + push, last-opened group, invite landing, legal. Not in destination: create-with-full-roster, group-wide invite, short join code, changing who I am.

**Users** — People on a trip or shared activity who need a running tally of who paid and who owes whom. Members are name-slots, not login identities. Someone can be on the ledger without installing the app.

**Constraints** —
- No user accounts (capability tokens prove access)
- Local-first / full offline, entity-level merge sync
- Stack: Expo React Native, Expo Router, Legend State, expo-sqlite, Cloudflare Worker + one SQLite Durable Object per group + D1 token/invite index
- Remote Worker `splitnext` at `https://splitnext.santistebanc94.workers.dev` (D1 `splitnext-index`)
- Access tokens in `expo-secure-store`
- Dev/demo: physical phone + Expo Go; `npm run web` runs the whole app in a browser for testing and screenshots, in a 420×900 phone frame when the window is wide (centered, scaled to fit the viewport — shrinks or grows as the window does)
- Money as integer cents; version (not timestamps) for conflicts; soft-delete only
- Device floor iOS 16+ / Android 12+; English-only; light-only UI
- Clients never talk to D1 or the Durable Object; the Worker is the only door, after a capability hash-check
- Slice quality: thin scope, high craft inside the slice (seams + TDD + review); speed ≠ skip quality

**Non-goals** — User accounts / OAuth, payment rails, contact import / social graphs, accounting / OCR / budgets / recurring bills, behavioural analytics, marketing site (invite landing is not that), OTA updates, full CRDT sync frameworks, dedicated sync platforms (ElectricSQL, PowerSync, Replicache), group-wide invite UI, short group join codes, create-with-full-roster, changing assumed member after create/join (D-076), close/reopen UI (MVP), a whole-group Settle up screen, lobby nets, dark mode / v1 brand chrome

## Capabilities

- Create a group from a form (group name, your name, currency), mint a per-device access token, persist locally with the creator already bound, sync the group to the server, and land on the hub of names — [slice 0001](slices/0001-walking-skeleton.md) / [slice 0027](slices/0027-first-run.md)
- Open a group hub: group name as large centered type above the list (header is home + settings); names until the first expense, then balances (You highlighted, tap opens member detail); add member + under the list; **View all expenses** at the bottom once spent; FAB + Expense once bound — [slice 0001](slices/0001-walking-skeleton.md) / [slice 0023](slices/0023-member-first-hub-chrome.md) / [slice 0027](slices/0027-first-run.md) / [slice 0028](slices/0028-member-rename.md)
- Reopen groups after app kill from SQLite + Secure Store lobby index — [slice 0001](slices/0001-walking-skeleton.md)
- Auto-flush outbound queue + thin inbound group fetch on group open and app foreground (all lobby groups) — [slice 0002](slices/0002-queue-auto-flush.md)
- Add name-slot members, bind this device to one (assumed member), show You on hub; roster list-pull on open/foreground — [slice 0003](slices/0003-members-binds.md)
- Sync split into flush / apply / subscribe modules behind a `groupSync` facade; typed clearable errors; queue identity by `entity_type + id + version` — [slice 0004](slices/0004-sync-quality-harden.md)
- Record an expense against the member who paid — integer cents, listed under All expenses, synced through the same merge path — [slice 0005](slices/0005-expense-spine.md) / [slice 0023](slices/0023-member-first-hub-chrome.md)
- Edit an existing expense from the list or a bucket line — equal or mixed split, share units and fixed cents restored on open — [slice 0029](slices/0029-expense-editor.md) / [slice 0030](slices/0030-mixed-splits.md)
- Assumed member is set at create or join and cannot be changed; leave unbinds — [slice 0005](slices/0005-expense-spine.md) / [slice 0027](slices/0027-first-run.md)
- Run the whole app in a browser (`npm run web`), which is what makes headless end-to-end runs and board screenshots possible — [slice 0006](slices/0006-web-target.md)
- Split every expense across the members chosen at record time (default everyone live), or by share units and fixed cents — frozen into the expense, identical on every device — [slice 0007](slices/0007-allocations-balances.md) / [slice 0018](slices/0018-expense-form.md) / [slice 0030](slices/0030-mixed-splits.md)
- Choose who paid and who shares on a dedicated new-expense screen; default is You paid and everyone shares — [slice 0018](slices/0018-expense-form.md)
- See each member's net position on the hub — paid minus owed, most-negative first, You marked — [slice 0007](slices/0007-allocations-balances.md) / [slice 0023](slices/0023-member-first-hub-chrome.md)
- See a member's expenses as paid-for and owe-for lines that add up to their net — [slice 0024](slices/0024-member-expense-buckets.md)
- See the fewest transfers that zero those nets on a member's screen (the ones they would pay); derived, identical on every device, never moves money — [slice 0017](slices/0017-settle-up.md) / [slice 0023](slices/0023-member-first-hub-chrome.md)
- Tap a settle button to open the new-expense form already filled for that transfer; saving records it, the tap does not — [slice 0019](slices/0019-settle-prefill.md) / [slice 0023](slices/0023-member-first-hub-chrome.md)
- Leave a group from Settings: this device is unbound and its token is revoked; the member and expenses stay — [slice 0025](slices/0025-leave-group.md) / [slice 0027](slices/0027-first-run.md)
- Rename a member from their screen; the bind stays — [slice 0028](slices/0028-member-rename.md)
- Reopen a group with several expenses without the screen crashing on revived `Date` timestamps — [slice 0007](slices/0007-allocations-balances.md)
- Record a clip per flow and stills for the board with `npm run capture`, driving the real app against the deployed Worker; CI asserts those same flows against a local Worker without rewriting the clips — [slice 0007](slices/0007-allocations-balances.md) / [slice 0022](slices/0022-capture-ci.md)
- Work the repo from any clone: the loop is vendored at `.claude/skills/`, `AGENTS.md` is the entry point, CI enforces the gates — [slice 0008](slices/0008-repo-home.md)
- Read the board and use the app as URLs, both published by CI on every merge, with code chips linking to GitHub — [slice 0008](slices/0008-repo-home.md)
- Read the symbol map two ways — flat by area, or as a tree nested under what calls what, derived from the source — [slice 0009](slices/0009-symbol-tree.md)
- Trust that what is on `main` is what is on the server — merge applies D1 migrations, redeploys the Worker, and fails unless every route answers with that merge's sha — [slice 0010](slices/0010-deploy-pipeline.md)
- Catch up a group whose wake socket died while the hub stayed open — the client retries the socket, then runs the same flush + roster pull as open, for that group only — [slice 0011](slices/0011-missed-wake.md) / [slice 0016](slices/0016-wake-reconnect.md)
- Invite another device onto a named member; they redeem a one-use 7-day `/j/{token}` link (11-char secret) and land already bound — [slice 0012](slices/0012-member-invites.md) / [slice 0028](slices/0028-member-rename.md)
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

**Member** — `id`, `group_id`, `display_name`, `version`, `updated_at`, `deleted_at`. Name-slot; not a login. Soft-delete only (UI for delete parked). Display name is editable from member detail.

**Bind** — `id`, `group_id`, `device_user_id`, `member_id`, `version`, `updated_at`, `deleted_at`. Active bind = assumed member. Unique: one active bind per device per group — set at create or join, then locked. A second member is refused; leave tombstones the bind so this install may bind again.

**Expense** — `id`, `group_id`, `payer_member_id`, `amount_cents`, `description`, `allocations`, `version`, `updated_at`, `deleted_at`. Integer cents only. `allocations` is `[{ member_id, amount_cents, share_units?, fixed_cents? }]` carried *inside* the expense (JSON text in the Durable Object), so one version number covers the whole split and a merge can never take a new amount while rejecting a share. Default equal 1-share among selected live members; mixed splits take fixed cents off the total first, then remainder by share units (D-085). The payer need not be in that set (D-068). Optional on the type: expenses recorded before slice 0007 carry none, and balances treat that as "payer credited, nobody debited". Pre-0030 rows with only `amount_cents` edit as 1 share each.

**Balance** (derived, never stored) — per live member, Σ paid − Σ owed across live expenses, sorted most-negative first.

**Member buckets** (derived, never stored) — per live member, the live expenses they touched as paid-for and owe-for lines. One line per expense; amount is their net on that expense; the lines sum to their balance. Paid-for names the other live allocated members; owe-for names the payer (D-074).

**Settlement** (derived, never stored) — the fewest transfers that zero those nets: `{ from_member_id, to_member_id, amount_cents }`. Zero-sum subgroups, then poorest↔richest inside each; unmatched leftover omitted. A member screen lists that person's outgoing transfers as **Suggested settlement** (text plus Settle); Settle opens the new-expense form; the tap does not move money (D-067, D-069, D-073).

**Access token** — server: `token_hash`, `group_id`, `device_user_id`, `revoked_at`. Client holds plaintext in Secure Store. One per device per group.

**Invite** — server only, not a merge entity: `token_hash`, `group_id`, `member_id`, `expires_at`, `redeemed_at`. One-use, 7-day. Secret is 11-char base64url. Redeeming mints an access token and a v1 bind for that member. Plaintext is shown once at mint as a `/j/{token}` URL (web) or the raw token (native).

**Outbound queue** (client) — per-group `{ entity_type, id, version, payload }` on the Legend store; flushed to `merge` in flush order. Auto-flushed on open, foreground, and wake-socket reconnect via `syncGroup`.

## Routes / surfaces

| Route | What it does | Shipped in |
| --- | --- | --- |
| `/` | Lobby (no header, content vertically centered): groups by name with a one-line member summary (hidden when empty), quiet Join with link, Create group under that; root AppState sync | slice 0001 / 0002 / 0012 / 0027 |
| `/create` | Create form: group name, your name, currency; submit opens the hub named and bound | slice 0027 |
| `/j/[token]` | Redeem an invite token from the URL; opens the hub already bound | slice 0012 / 0028 |
| `/join` | Same redeem as `/j/[token]`, via `?token=` (legacy) | slice 0012 |
| `/group/[id]` | Hub: group name as large centered type above the list (header is home + settings); names until the first expense (rows open member detail; no expense list link), then balances (You highlighted; tap opens member detail); add member + under the list; **View all expenses** at the bottom once spent; FAB + Expense once bound; typed sync error; open → syncGroup | slice 0001–0007 / 0012 / 0017 / 0018 / 0019 / 0023 / 0027 / 0028 |
| `/group/[id]/settings` | Group name and currency; Done once named and bound; Leave group | slice 0027 |
| `/group/[id]/member/[memberId]` | Member: name + edit in the header; join link + copy/share if unclaimed; paid-for / owe-for / net / suggested settlement once the group has an expense; a bucket line opens that expense | slice 0023 / 0024 / 0025 / 0027 / 0028 / 0029 |
| `/group/[id]/expenses` | All expenses, newest first; a row opens the expense editor | slice 0023 / 0029 |
| `/group/[id]/expense/new` | New expense: payer, amount, description, who shares (equal 1-share default; +/- shares and tap amount for fixed) | slice 0018 / 0019 / 0030 |
| `/group/[id]/expense/[expenseId]` | Same form, filled from a stored expense; save writes the next version | slice 0029 |

## Seams

- `shouldAcceptVersion` / `sortByFlushOrder` — `src/domain/version.ts` — vitest
- `shouldAttemptFlush` / `queueAfterMergeResults` — `src/sync/queuePolicy.ts` — vitest
- `assumedMemberIdFromBinds` / `bindingIsOpen` / `memberIsClaimed` — `src/domain/assumedMember.ts` — vitest — assumed member from this device's live bind; whether the group has no live expense (hub names vs balances)
- `tombstoneBind` / `bindOnce` — `src/domain/bind.ts` — vitest — soft-delete a live bind at the next version; this device may bind only once
- Worker routes behind `src/api/edge.ts` — vitest against a local Worker (`createTestHarness` + D1 migrations), never `workers.dev` — the HTTP capability boundary. Wake WebSocket at `/wake/:groupId` is the same harness: auth + tip after merge. `leave-group` revokes the token (D-075).
- `syncError` / `coerceSyncError` — `src/sync/syncErrors.ts` — vitest
- `getSecret` / `setSecret` / `deleteSecret` — `src/secrets/secureStorage.ts` — the platform split for secrets; a fake here replaces the keychain
- `persistPlugin` — `src/store/persistPlugin.ts` — the platform split for durability
- `splitEqually` / `participantsForSplit` — `src/domain/split.ts` — vitest
- `allocateMixed` — `src/domain/allocateMixed.ts` — vitest — fixed cents then share units; leftover by remainder then member id
- `equalSplitState` / `increaseMemberSplit` / `decreaseMemberSplit` / `commitMemberFixedAmount` / `deriveSplitEditor` — `src/domain/splitEditor.ts` — vitest — v1 split editor transitions
- `patchExpense` — `src/domain/expense.ts` — vitest — next expense version for a split edit (equal or mixed); unchanged intent or an invalid share set is null
- `computeBalances` — `src/domain/balances.ts` — vitest
- `suggestSettlements` / `settlementsForMember` — `src/domain/settle.ts` — vitest
- `memberBuckets` — `src/domain/buckets.ts` — vitest — one member's paid-for / owe-for lines; they sum to that member's net
- `patchGroup` / `settingsDoneEnabled` / `createGroupDraft` — `src/domain/group.ts` — vitest — next group version for a name and/or currency patch; empty currency keeps the current label. Done on Settings needs a name and an assumed member. Create draft is named group + creator + bind, or null.
- `formatCents` / `formatMoney` / `memberLabel` — `src/ui/format.ts` — integer cents as decimal text with the currency's symbol; assumed member is You
- `currencySymbol` / `allCurrencies` — `src/domain/currency.ts` — vitest — ISO code to display symbol; picker catalog of tender currencies
- `lobbyGroupTitle` / `lobbyMemberSummary` — `src/domain/lobby.ts` — vitest — lobby row title and one-line live member list
- `patchMember` — `src/domain/member.ts` — vitest — next member version for a display-name change; whitespace or unchanged name is null
- `phoneFrame` / `InFrameOverlay` — `src/ui/phoneFrame.ts` / `src/ui/inFrameOverlay.tsx` / `app/+html.tsx` — web-only: a 420×900 phone frame when the window is wider than 480px, always centered and scaled to fit the viewport (shrinks or grows as the window does); drawers portal into that frame instead of covering the desktop; capture's 420 viewport stays full-bleed
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
- `inviteIsLive` / `parseInviteToken` / `joinPathForToken` — `src/domain/invite.ts` — vitest (`tests/domain/invite.test.ts`)
- `inviteShareText` — `src/sync/inviteShareText.ts` / `src/sync/inviteShareText.web.ts` — raw token on native, `/j/{token}` URL on web
- `shouldCatchUpOnStatus` / `shouldReplaceSubscription` / `nextReconnectDelayMs` — `src/sync/wakePolicy.ts` — vitest — whether a wake-socket status change means this group missed wakes, whether a dead socket should be replaced, and how long to wait before retrying
- `wakeUrl` — `src/sync/wakeUrl.ts` — vitest — query-string token on `/wake/:groupId`; RN `WebSocket` cannot set headers
- `phone_section` — `docs/scripts/pr_phone.py` — unittest via `npm run test:board` — the PR comment's Camera QR of the published `/app`
