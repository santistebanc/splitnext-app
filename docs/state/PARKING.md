# Parking

## Foundation-risk

- **Contract test against a local Supabase stack** — the flow tests fake `src/api/edge.ts` and import the server's real `shouldAccept`, but response shapes can still drift; run the real `merge` / `fetch-entity` / `list-roster` at close when their shapes change — area: sync — raised: slice 0004
- **Browser-driven flow tests** — the web target runs the whole app headless (Playwright drove create → add member → bind → add expense against the real Edge Functions), so end-to-end tests are possible for the first time; nothing is committed yet, and web does not exercise the SQLite persist adapter — area: testing — raised: slice 0006
- **Symbol-level change attribution on the board** — the working-tree delta maps changed *files* to symbols, so a shared file drags its neighbours in; needs diff-hunk ranges to fix — area: tooling — raised: slice 0004
- **Missed-wake detection** — "Reconnect and missed-wake detection — how a client that was offline during a wake learns it missed changes" — area: sync — raised: bootstrap · *partially mitigated by thin fetch-on-open/foreground in 0002 + roster list in 0003; full protocol still open*
- **Realtime JWT signing secret** — leave `anon_channel` fallback; mint short-lived JWT for private channel auth (D-006) — area: sync — raised: slice 0001
- **Multi-install recovery** — "Multi-install recovery when the device user id is lost — with no accounts, there is currently no recovery path" — area: recovery — raised: bootstrap
- **Invite rate limits** — "Rate limits on invite links (7-day + one-use is product-decided; no enforcement design yet)" — area: abuse — raised: bootstrap

## Core value

- **Reopen the binding choice after an expense exists** — "in the future it will be possible to change in other way" — the first expense closes it for good today (D-020); reopening has to decide what happens to expenses already attributed to the old member — area: membership — raised: slice 0005

- **Member rename / soft-delete** — rename any assumed member; soft-delete; never hard-delete while referenced — area: membership — raised: bootstrap
- **Expense editor + invariants** — contributions/allocations, Hamilton rounding, defaults (payer = assumed member, equal shares) — area: ledger — raised: bootstrap
- **Balances list (group hub home)** — derived Σ contributions − Σ allocations; sort most-negative first; "You (Name)" — area: ledger — raised: bootstrap
- **Member invites** — HTTPS deep link join; mint access token; preselect / picker / add-new — area: invites — raised: bootstrap
- **Settle-up suggestions** — minimise transfer count via group-net flows; prefill settlement expense — area: ledger — raised: bootstrap
- **Leave group** — unbind + revoke this device’s access token; member history remains — area: membership — raised: bootstrap

## Breadth

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

- **Assumed member gates mutations** — delivered in [slice 0005](slices/0005-expense-spine.md); the expense form only appears once this device is bound

- **Walking skeleton** — delivered in [slice 0001](slices/0001-walking-skeleton.md)
- **Outbound queue auto-flush + thin reconnect fetch** — delivered in [slice 0002](slices/0002-queue-auto-flush.md)
- **Members + binds / assumed member (add, bind, roster pull)** — delivered in [slice 0003](slices/0003-members-binds.md)
