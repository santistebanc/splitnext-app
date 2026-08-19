# Parking

Steering after 0029 (v1 feature pass): take the old app's remaining product, keep this app's surfaces, drop four v1 shapes. Recorded as D-084.

## Foundation-risk

- **Activity spine** — `expense_added` through rename/kick/edit/delete plus join/leave/group-rename, hub recent section, Activity page, relative timestamps, hub toast — delivered through [slice 0034](slices/0034-activity-spine.md) / [slice 0035](slices/0035-activity-toast.md) / [slice 0036](slices/0036-activity-event-kinds.md) / [slice 0053](slices/0053-activity-join-leave-rename.md). Undo of add/delete/kick — [slice 0040](slices/0040-activity-undo.md) / hub recent undo — slice 0056 (in flight). Still parked: undo of edit/rename. — area: activity — raised: bootstrap · restated: steering after 0029
- **Mixed / uneven splits** — delivered in [slice 0030](slices/0030-mixed-splits.md).

- **Soft-delete an expense** — delivered in [slice 0031](slices/0031-expense-delete.md).

- **Kick / soft-delete a member** — delivered in [slice 0033](slices/0033-kick-member.md).
- **Browser-driven flow tests** — CI now asserts a clean console plus balances/settle surviving a reload against a local Worker (slice 0022); it is still not in `npm test`, has no fuller failure taxonomy, and web still does not exercise the SQLite persist adapter — area: testing — raised: slice 0006 · *partially delivered in 0007 / 0022*
- **Server-side cursor / wake log** — "a wake log or group tip the client compares on reconnect" — declined in slice 0011 in favour of reusing `syncGroup`; return if roster pull on reconnect ever hurts — area: sync — raised: slice 0011
- **Multi-install recovery** — "Multi-install recovery when the device user id is lost — with no accounts, there is currently no recovery path" — area: recovery — raised: bootstrap
- **Invite rate limits** — "Rate limits on invite links (7-day + one-use is product-decided; no enforcement design yet)" — area: abuse — raised: bootstrap
- **Push notifications** — Expo push on foreign activity, device-token Worker routes — delivered in [slice 0038](slices/0038-push-notifications.md). Expo Go skip of `expo-notifications` — [slice 0043](slices/0043-expo-go-push-skip.md). Still parked: per-group mute. — area: awareness — raised: steering after 0029

## Core value

- **Reopen the binding choice after an expense exists** — dropped: "make it so its no never possible to change assumed member (you can however rename any member and edit expenses normally)". Bind is once (create or join); leave unbinds; rename (0028) and equal-split expense edit (0029) are the fixes. D-020 reversed to lock-on-first-bind (D-076). Confirmed again: do not take v1's Settings "who I am". — area: membership — raised: slice 0005 · restated: slice 0027 / steering after 0029

- **This is me as a Settings field** — dropped: "ok lets drop the field at settings to change assumed member" — area: membership — raised: slice 0026

- **Create with a whole roster** — dropped (D-084): v1's create form adds several names and picks me. Keep D-077: group name, your name, currency; add others after. — area: membership — raised: steering after 0029

- **Group-wide invite / short join code** — dropped (D-084). Per-member one-use `/j/{token}` stays (D-056, D-080). Joiner-side picker / add-new was the group-invite join shape; not taking it. — area: invites — raised: bootstrap · restated: steering after 0029

- **Member rename / soft-delete** — rename delivered in 0028; kick stays under Foundation-risk above. — area: membership — raised: bootstrap · restated: slice 0027 · *partially delivered in 0028*

- **Expense editor + invariants** — equal edit (0029), mixed splits (0030), delete (0031). Prototype edits in a sheet; add stays `L-expenseNew`. — area: ledger — raised: bootstrap · restated: slice 0027 / steering after 0029 · *delivered through 0031*

- **Member invites** — mint + redeem for a named member shipped (0012 / 0028). App links / deep-link hosting still parked (breadth). Group-wide invite dropped. — area: invites — raised: bootstrap · *partially delivered in 0012*
- **Invite page status / resend** — Join link on unclaimed member detail ships in 0027/0028; active / expired / resend still needs a Worker list of invite metadata. Per-member, not a group invite. — area: invites — raised: slice 0025 · restated: steering after 0029
- **Reactivate invite on leave** — dropped: "or okay the thing about leaving and reactivating the link maybe its not good idea, forget that". Invite stays one-use (D-056); leave unbinds and the slot stays (D-075); a new Invite mints a new link. — area: invites — raised: slice 0027

## Breadth

- **Last opened group on launch** — delivered in [slice 0037](slices/0037-last-opened-group.md).
- **Store listings** — Play / App Store buttons on the landing when a listing exists. Do not link the v1 listing. — area: distribution — raised: slice 0039
- **Preview deploys per PR** — Pages publishes only `main`, so a PR cannot be looked at before it merges; a per-PR Worker + staging D1 would give an isolated URL (slice branches still share the one production Worker) — area: deploy — raised: slice 0008
- **EU Durable Object jurisdiction** — group data lives where Cloudflare places the DO today; pin to EU if residency matters — area: deploy — raised: slice 0014
- **Invite URL path** — "Exact HTTPS invite URL path shape on splitnext.online" — `/j/{token}` shipped (D-080); the short origin is still parked — area: invites — raised: bootstrap · *partially delivered in 0028*
- **Retention / deletion policy** — privacy copy in [slice 0042](slices/0042-legal.md) (GitHub issue, no join-code wipe). A self-serve wipe is still out. — area: data — raised: bootstrap · restated: steering after 0029 · *partially delivered in 0042*
- **Expense note required vs optional** — area: ux — raised: bootstrap
- **Close / reopen group UI** — capability rules exist; screens deferred — area: groups — raised: bootstrap
- **Deep link hosting** — `.well-known` + fallback on splitnext.online; needs dev/prod build (not Expo Go). Pairs with invite landing. — area: invites — raised: bootstrap · restated: steering after 0029
- **Expo Go against `wrangler dev`** — "would the expo go in my phone work well with local worker?" Phone keeps the deployed URL; tests boot a separate miniflare Worker — area: dev — raised: slice 0020

## Polish

- **Delta matches symbol names as plain English words** — `merge / mergeOne` was explained by a Before → After row about merging to `main`, because the row contains the word "merge". An `L-` id citation should outrank a bare word match — area: board — raised: slice 0010
- **Reconnecting indicator on the hub** — silent today, same as foreground; a chrome that says the socket dropped — area: ui — raised: slice 0011
- **Transaction tolerance on settle-up** — "ignore leftovers under $1" — Settle Up's extra; this slice ships exact cents — area: ledger — raised: slice 0017

- **Import-level dependency view** — a second graph on the board, module to module rather than symbol to symbol; the tree draws call sites only — area: board — raised: slice 0009
- **Wire-hop edges in the symbol graph** — draw `mergeEntities` → `merge` as a distinct kind of edge so the tree can cross the device/server boundary the way Flows does; today it is not a call and so not an edge — area: board — raised: slice 0009
- **Lobby index out of Secure Store** — move `lobby_group_ids` to Legend/SQLite; Secure Store for secrets only — area: client — raised: slice 0001
- **Design system application** — locked palette/components in blueprint; apply across screens. Slice 0023 extracts prototype tokens and restacks the hub; lobby / join / expense-form layouts stay. Do not take v1 dark mode / fonts / avatar seeds (D-084 keep surfaces). — area: ui — raised: bootstrap · restated: steering after 0029 · *partially 0023*
- **Smooth member view transitions** — "smooth view transitions, where each member is smoothly transitioned from view to view". Folded into hub-as-shell below. — area: ui — raised: slice 0025 · restated: 2026-08-19
- **Invite copy/share sheet** — prototype copy/share sheet after mint; today the join link lands on the screen that minted — area: ui — raised: slice 0023
- **Expense editor as a sheet** — hub-chrome.html adds/edits in a bottom sheet; add stays the dedicated `L-expenseNew` screen (keep this surface). Folded into hub-as-shell below if that lands. — area: ui — raised: slice 0023 · restated: 2026-08-19
- **Hub as the only place (no in-app routes)** — delivered across [slice 0046](slices/0046-hub-shell-activity.md)–[slice 0051](slices/0051-lobby-switcher.md): settings, all-expenses, expense form, activity/member expand, lobby-as-switcher on Home. `/j/{token}` and create/join routes remain URLs. Smooth transitions and expense-as-sheet stay separate parked items. — area: ui — raised: 2026-08-19
- **Debug telemetry** — crash reporter; tags group_id + device_user_id only — area: observability — raised: bootstrap
- **Handoff checklist** — "Final spec section outline and the acceptance checklist proving the design is implementable" — area: meta — raised: bootstrap

## Delivered

<!-- kept until it is two slices old, then pruned: the point is that the user
     sees their input landed, not a second changelog. -->

- **Pending expense badge** — delivered in [slice 0044](slices/0044-pending-expense-badge.md). All expenses shows Pending while queued.

- **Hub name descenders** — delivered in [slice 0045](slices/0045-hub-name-descenders.md). Roster/balance line boxes are 1.4× font.

- **Headerless hub + activity expand** — delivered in [slice 0046](slices/0046-hub-shell-activity.md). First hub-as-shell slice.

- **Member accordion on hub** — delivered in [slice 0047](slices/0047-member-accordion.md). Balance/roster tap expands member detail; Close returns.

- **Settings overlay on hub** — delivered in [slice 0048](slices/0048-settings-overlay.md). Settings gear expands in place; Close/Done return.

- **All-expenses overlay on hub** — delivered in [slice 0049](slices/0049-all-expenses-overlay.md). **View all expenses** expands in place; Close returns.
- **Expense form overlay on hub** — delivered in [slice 0050](slices/0050-expense-form-overlay.md).
- **Lobby-as-switcher on hub** — delivered in [slice 0051](slices/0051-lobby-switcher.md). Home expands the group list; Close returns.

- **Wake orchestrator tests** — delivered in [slice 0055](slices/0055-wake-orchestrator-tests.md). `startWakeSubscription` proven against local Worker.

- **Expense form overlay on hub** — delivered in [slice 0050](slices/0050-expense-form-overlay.md). FAB, rows, buckets, and settle expand `L-expenseForm`; save/delete/**Close** return.
