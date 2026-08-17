# Parking

## Foundation-risk

- **Browser-driven flow tests** — CI now asserts a clean console plus balances/settle surviving a reload against a local Worker (slice 0022); it is still not in `npm test`, has no fuller failure taxonomy, and web still does not exercise the SQLite persist adapter — area: testing — raised: slice 0006 · *partially delivered in 0007 / 0022*
- **Driving `startWakeSubscription` against a local Worker** — the wake *wire* is contract-tested (slice 0021); the client orchestrator (token store, inbound fetch, module Maps) is not — area: sync — raised: slice 0021
- **Server-side cursor / wake log** — "a wake log or group tip the client compares on reconnect" — declined in slice 0011 in favour of reusing `syncGroup`; return if roster pull on reconnect ever hurts — area: sync — raised: slice 0011
- **Multi-install recovery** — "Multi-install recovery when the device user id is lost — with no accounts, there is currently no recovery path" — area: recovery — raised: bootstrap
- **Invite rate limits** — "Rate limits on invite links (7-day + one-use is product-decided; no enforcement design yet)" — area: abuse — raised: bootstrap

## Core value

- **Reopen the binding choice after an expense exists** — dropped: "make it so its no never possible to change assumed member (you can however rename any member and edit expenses normally)". Bind is once (create or join); leave unbinds; rename and expense edit are the fixes. D-020 reversed to lock-on-first-bind (D-076). — area: membership — raised: slice 0005 · restated: slice 0027

- **This is me as a Settings field** — dropped: "ok lets drop the field at settings to change assumed member" — area: membership — raised: slice 0026

- **Member rename / soft-delete** — "you can however rename any member" / "on edit then you show the list of members (name + button to edit name + button to remove/kickout)" — rename any member; soft-delete; never hard-delete while referenced — area: membership — raised: bootstrap · restated: slice 0027 · *appetite: next after 0027*

- **Expense editor + invariants** — "edit expenses normally" / edit an existing expense from the list or a bucket line; uneven / share-based splits. Prototype edits in a sheet; add stays `L-expenseNew` until that chrome earns its keep. Slice 0018 shipped the add form; 0019 shipped settle-up tap → prefill — area: ledger — raised: bootstrap · restated: slice 0027 · *appetite: next after 0027*

- **Member invites** — HTTPS deep link join; joiner-side picker / add-new; claimed exclusive slot. Slice 0012 shipped mint + redeem for a named member (`/join` + lobby paste); app links and group-wide invite stay parked — area: invites — raised: bootstrap · *partially delivered in 0012*
- **Kick out** — "button to remove/kickout" on the edit-members list (was: member detail in hub-chrome.html) — soft-delete a member; never hard-delete while referenced — area: membership — raised: slice 0023 · restated: slice 0025
- **Invite page status** — Invite on the names hub or on unclaimed member detail ships in 0027; "if invitation is active or invitation expired" / resend still needs a Worker list of invite metadata — area: invites — raised: slice 0025
- **Reactivate invite on leave** — dropped: "or okay the thing about leaving and reactivating the link maybe its not good idea, forget that". Invite stays one-use (D-056); leave unbinds and the slot stays (D-075); a new Invite mints a new link. — area: invites — raised: slice 0027

## Breadth

- **Preview deploys per PR** — Pages publishes only `main`, so a PR cannot be looked at before it merges; a per-PR Worker + staging D1 would give an isolated URL (slice branches still share the one production Worker) — area: deploy — raised: slice 0008
- **EU Durable Object jurisdiction** — group data lives where Cloudflare places the DO today; pin to EU if residency matters — area: deploy — raised: slice 0014
- **Invite URL path** — "Exact HTTPS invite URL path shape on splitnext.online" — area: invites — raised: bootstrap
- **Activity feed** — twelve event types; client-authored; flushed last. Hub-chrome.html puts the list in a burger drawer — area: activity — raised: bootstrap · *appetite: next after 0023*
- **Retention / deletion policy** — area: data — raised: bootstrap
- **Expense note required vs optional** — area: ux — raised: bootstrap
- **Close / reopen group UI** — capability rules exist; screens deferred — area: groups — raised: bootstrap
- **Group-wide invite UI** — deferred from MVP chrome — area: invites — raised: bootstrap
- **Deep link hosting** — `.well-known` + fallback on splitnext.online; needs dev/prod build (not Expo Go) — area: invites — raised: bootstrap
- **Expo Go against `wrangler dev`** — "would the expo go in my phone work well with local worker?" Phone keeps the deployed URL; tests boot a separate miniflare Worker — area: dev — raised: slice 0020

## Polish

- **Delta matches symbol names as plain English words** — `merge / mergeOne` was explained by a Before → After row about merging to `main`, because the row contains the word "merge". An `L-` id citation should outrank a bare word match — area: board — raised: slice 0010
- **Reconnecting indicator on the hub** — silent today, same as foreground; a chrome that says the socket dropped — area: ui — raised: slice 0011
- **Transaction tolerance on settle-up** — "ignore leftovers under $1" — Settle Up's extra; this slice ships exact cents — area: ledger — raised: slice 0017

- **Import-level dependency view** — a second graph on the board, module to module rather than symbol to symbol; the tree draws call sites only — area: board — raised: slice 0009
- **Wire-hop edges in the symbol graph** — draw `mergeEntities` → `merge` as a distinct kind of edge so the tree can cross the device/server boundary the way Flows does; today it is not a call and so not an edge — area: board — raised: slice 0009
- **Lobby index out of Secure Store** — move `lobby_group_ids` to Legend/SQLite; Secure Store for secrets only — area: client — raised: slice 0001
- **Design system application** — locked palette/components in blueprint; apply across screens. Slice 0023 extracts prototype tokens and restacks the hub; lobby / join / expense-form layouts stay — area: ui — raised: bootstrap · *partially 0023*
- **Activity burger drawer** — "Burger opens Activity drawer (full scrollable list)" from hub-chrome.html — area: ui — raised: slice 0023 · *appetite: next after 0023*
- **Invite page status** — Invite on hub names / unclaimed member detail in 0027; "if invitation is active or invitation expired" / resend still needs a Worker list of invite metadata — area: invites — raised: slice 0025
- **Smooth member view transitions** — "smooth view transitions, where each member is smoothly transitioned from view to view" — area: ui — raised: slice 0025
- **Invite copy/share sheet** — prototype copy/share sheet after mint; today the join link lands on the screen that minted — area: ui — raised: slice 0023
- **Expense editor as a sheet** — hub-chrome.html adds/edits in a bottom sheet; add stays the dedicated `L-expenseNew` screen — area: ui — raised: slice 0023 · *appetite: next after 0023*
- **Debug telemetry** — crash reporter; tags group_id + device_user_id only — area: observability — raised: bootstrap
- **Handoff checklist** — "Final spec section outline and the acceptance checklist proving the design is implementable" — area: meta — raised: bootstrap

## Delivered

<!-- kept until it is two slices old, then pruned: the point is that the user
     sees their input landed, not a second changelog. -->

- **Leave group** — delivered in [slice 0025](slices/0025-leave-group.md); unbind + revoke this device’s token; member and expenses stay. Surface moved to Settings in 0027. Kick and reclaim-slot stay parked.

- **First-run create** — delivered in [slice 0027](slices/0027-first-run.md); form then hub of names, bind once, lobby by name, Settings without a roster.
