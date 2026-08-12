# Parking

## Foundation-risk

- **Dev remote, prod still merge-only** — "should we not have a remote postgres db that is just for dev which can be modified for the current slice that has not yet been merged in the pr" — persistent `splitnext-v3-dev`; local `.env` points at it; CI/Pages keep pointing at prod; slice-branch push to *dev* is allowed; D-052 still forbids hand-deploy to prod. Reset dev from the repo's migrations at the start of a server slice. Local `supabase start` stays the contract-test item, not the Expo Go target. — area: deploy — raised: slice 0012

- **Contract test against a local Supabase stack** — the flow tests fake `src/api/edge.ts` and import the server's real `shouldAccept`, but response shapes can still drift; run the real `merge` / `fetch-entity` / `list-roster` at close when their shapes change — area: sync — raised: slice 0004
- **Browser-driven flow tests** — `npm run capture` (slice 0007) commits the Playwright driver and asserts a clean console plus balances surviving a reload, but it is a capture run, not a test suite: it is not in `npm test`, has no failure taxonomy, and web still does not exercise the SQLite persist adapter — area: testing — raised: slice 0006 · *partially delivered in 0007*
- **Server-side cursor / wake log** — "a wake log or group tip the client compares on reconnect" — declined in slice 0011 in favour of reusing `syncGroup`; return if roster pull on reconnect ever hurts — area: sync — raised: slice 0011
- **Realtime JWT signing secret** — leave `anon_channel` fallback; mint short-lived JWT for private channel auth (D-006) — area: sync — raised: slice 0001
- **Multi-install recovery** — "Multi-install recovery when the device user id is lost — with no accounts, there is currently no recovery path" — area: recovery — raised: bootstrap
- **Invite rate limits** — "Rate limits on invite links (7-day + one-use is product-decided; no enforcement design yet)" — area: abuse — raised: bootstrap

## Core value

- **Reopen the binding choice after an expense exists** — "in the future it will be possible to change in other way" — the first expense closes it for good today (D-020); reopening has to decide what happens to expenses already attributed to the old member — area: membership — raised: slice 0005

- **Member rename / soft-delete** — rename any assumed member; soft-delete; never hard-delete while referenced — area: membership — raised: bootstrap
- **Expense editor + invariants** — edit an existing expense; participant picker; uneven / share-based splits with real largest-remainder ranking; defaults (payer = assumed member, equal shares). Slice 0007 shipped the equal-split half only, at record time, with no way to change it after — area: ledger — raised: bootstrap
- **Member invites** — HTTPS deep link join; joiner-side picker / add-new; claimed exclusive slot. Slice 0012 shipped mint + redeem for a named member (`/join` + lobby paste); app links and group-wide invite stay parked — area: invites — raised: bootstrap · *partially delivered in 0012*
- **Settle-up suggestions** — minimise transfer count via group-net flows; prefill settlement expense — area: ledger — raised: bootstrap
- **Leave group** — unbind + revoke this device’s access token; member history remains — area: membership — raised: bootstrap

## Breadth

- **Preview deploys per PR** — Pages publishes only `main`, so a PR cannot be looked at before it merges; a Vercel or Cloudflare project would give a URL per branch — area: deploy — raised: slice 0008
- **Invite URL path** — "Exact HTTPS invite URL path shape on splitnext.online" — area: invites — raised: bootstrap
- **Activity feed** — twelve event types; client-authored; flushed last — area: activity — raised: bootstrap
- **Member detail** — paid-for / owes-for buckets; leave group — area: membership — raised: bootstrap
- **All-expenses list** — area: expenses — raised: bootstrap
- **Group settings** — rename, currency relabel — area: groups — raised: bootstrap
- **Retention / deletion policy** — area: data — raised: bootstrap
- **Expense note required vs optional** — area: ux — raised: bootstrap
- **Close / reopen group UI** — capability rules exist; screens deferred — area: groups — raised: bootstrap
- **Group-wide invite UI** — deferred from MVP chrome — area: invites — raised: bootstrap
- **Deep link hosting** — `.well-known` + fallback on splitnext.online; needs dev/prod build (not Expo Go) — area: invites — raised: bootstrap

## Polish

- **Delta matches symbol names as plain English words** — `merge / mergeOne` was explained by a Before → After row about merging to `main`, because the row contains the word "merge". An `L-` id citation should outrank a bare word match — area: board — raised: slice 0010
- **Reconnecting indicator on the hub** — silent today, same as foreground; a chrome that says the socket dropped — area: ui — raised: slice 0011

- **Import-level dependency view** — a second graph on the board, module to module rather than symbol to symbol; the symbol tree draws call sites only — area: board — raised: slice 0009
- **Wire-hop edges in the symbol graph** — draw `mergeEntities` → `merge` as a distinct kind of edge so the tree can cross the device/server boundary the way Flows does; today it is not a call and so not an edge — area: board — raised: slice 0009
- **Lobby index out of Secure Store** — move `lobby_group_ids` to Legend/SQLite; Secure Store for secrets only — area: client — raised: slice 0001
- **Design system application** — locked palette/components in blueprint; apply across screens — area: ui — raised: bootstrap
- **Debug telemetry** — crash reporter; tags group_id + device_user_id only — area: observability — raised: bootstrap
- **Handoff checklist** — "Final spec section outline and the acceptance checklist proving the design is implementable" — area: meta — raised: bootstrap

## Delivered

<!-- kept until it is two slices old, then pruned: the point is that the user
     sees their input landed, not a second changelog. -->

- **Missed-wake reconnect** — delivered in [slice 0011](slices/0011-missed-wake.md); a dropped Realtime socket returning to `SUBSCRIBED` runs the same `syncGroup` as open, for that group only. No cursor.

- **Member invites (mint + redeem)** — delivered in [slice 0012](slices/0012-member-invites.md); per-member one-use link, `/join` + lobby paste. App links and joiner picker still parked.
