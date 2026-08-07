# Parking

## Foundation-risk

- **Deploy drift between local and remote** — the remote was missing the whole `expenses` table and carried a stale `fetch-entity`, three slices after 0005 said both shipped. Nothing checks that what is committed is what is deployed; `supabase db dump` needs Docker, which this machine does not have — area: deploy — raised: slice 0007
- **Contract test against a local Supabase stack** — the flow tests fake `src/api/edge.ts` and import the server's real `shouldAccept`, but response shapes can still drift; run the real `merge` / `fetch-entity` / `list-roster` at close when their shapes change — area: sync — raised: slice 0004
- **Browser-driven flow tests** — `npm run capture` (slice 0007) commits the Playwright driver and asserts a clean console plus balances surviving a reload, but it is a capture run, not a test suite: it is not in `npm test`, has no failure taxonomy, and web still does not exercise the SQLite persist adapter — area: testing — raised: slice 0006 · *partially delivered in 0007*
- **Missed-wake detection** — "Reconnect and missed-wake detection — how a client that was offline during a wake learns it missed changes" — area: sync — raised: bootstrap · *partially mitigated by thin fetch-on-open/foreground in 0002 + roster list in 0003; full protocol still open*
- **Realtime JWT signing secret** — leave `anon_channel` fallback; mint short-lived JWT for private channel auth (D-006) — area: sync — raised: slice 0001
- **Multi-install recovery** — "Multi-install recovery when the device user id is lost — with no accounts, there is currently no recovery path" — area: recovery — raised: bootstrap
- **Invite rate limits** — "Rate limits on invite links (7-day + one-use is product-decided; no enforcement design yet)" — area: abuse — raised: bootstrap

## Core value

- **Reopen the binding choice after an expense exists** — "in the future it will be possible to change in other way" — the first expense closes it for good today (D-020); reopening has to decide what happens to expenses already attributed to the old member — area: membership — raised: slice 0005

- **Member rename / soft-delete** — rename any assumed member; soft-delete; never hard-delete while referenced — area: membership — raised: bootstrap
- **Expense editor + invariants** — edit an existing expense; participant picker; uneven / share-based splits with real largest-remainder ranking; defaults (payer = assumed member, equal shares). Slice 0007 shipped the equal-split half only, at record time, with no way to change it after — area: ledger — raised: bootstrap
- **Member invites** — HTTPS deep link join; mint access token; preselect / picker / add-new — area: invites — raised: bootstrap
- **Settle-up suggestions** — minimise transfer count via group-net flows; prefill settlement expense — area: ledger — raised: bootstrap
- **Leave group** — unbind + revoke this device’s access token; member history remains — area: membership — raised: bootstrap

## Breadth

- **Import-level dependency view** — a second graph on the board, module to module rather than symbol to symbol; the symbol tree draws call sites only — area: board — raised: slice 0009
- **Wire-hop edges in the symbol graph** — draw `mergeEntities` → `merge` as a distinct kind of edge so the tree can cross the device/server boundary the way Flows does; today it is not a call and so not an edge — area: board — raised: slice 0009
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

- **Lobby index out of Secure Store** — move `lobby_group_ids` to Legend/SQLite; Secure Store for secrets only — area: client — raised: slice 0001
- **Design system application** — locked palette/components in blueprint; apply across screens — area: ui — raised: bootstrap
- **Debug telemetry** — crash reporter; tags group_id + device_user_id only — area: observability — raised: bootstrap
- **Handoff checklist** — "Final spec section outline and the acceptance checklist proving the design is implementable" — area: meta — raised: bootstrap

## Delivered

- **Balances list (group hub home)** — delivered in [slice 0007](slices/0007-allocations-balances.md); derived Σ paid − Σ owed, most-negative first, You (Name) marked

- **Symbol-level change attribution on the board** — delivered in slice 0007; the delta now maps diff *hunks* onto the symbol whose declaration they fall under, bounded by the next declaration in the source. 15 reported symbols became 6, all six real

- **Assumed member gates mutations** — delivered in [slice 0005](slices/0005-expense-spine.md); the expense form only appears once this device is bound

- **Walking skeleton** — delivered in [slice 0001](slices/0001-walking-skeleton.md)
- **Outbound queue auto-flush + thin reconnect fetch** — delivered in [slice 0002](slices/0002-queue-auto-flush.md)
- **Members + binds / assumed member (add, bind, roster pull)** — delivered in [slice 0003](slices/0003-members-binds.md)
