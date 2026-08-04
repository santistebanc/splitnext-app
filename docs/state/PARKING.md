# Parking

## Foundation-risk

- **Missed-wake detection** — "Reconnect and missed-wake detection — how a client that was offline during a wake learns it missed changes" — area: sync — raised: bootstrap
- **Outbound queue auto-flush** — flush persisted queue on app open / reconnect so offline bumps upload without another tap — area: sync — raised: slice 0001
- **Realtime JWT signing secret** — leave `anon_channel` fallback; mint short-lived JWT for private channel auth (D-006) — area: sync — raised: slice 0001
- **Multi-install recovery** — "Multi-install recovery when the device user id is lost — with no accounts, there is currently no recovery path" — area: recovery — raised: bootstrap
- **Invite rate limits** — "Rate limits on invite links (7-day + one-use is product-decided; no enforcement design yet)" — area: abuse — raised: bootstrap

## Core value

- **Assumed member / bind** — mutations require assumed member; unbound = read-only browse — area: membership — raised: bootstrap
- **Members as merge entities** — add/rename/soft-delete members; schema + merge path — area: membership — raised: bootstrap
- **Expense editor + invariants** — contributions/allocations, Hamilton rounding, defaults (payer = assumed member, equal shares) — area: ledger — raised: bootstrap
- **Balances list (group hub home)** — derived Σ contributions − Σ allocations; sort most-negative first; "You (Name)" — area: ledger — raised: bootstrap
- **Member invites** — HTTPS deep link join; mint access token; preselect / picker / add-new — area: invites — raised: bootstrap
- **Settle-up suggestions** — minimise transfer count via group-net flows; prefill settlement expense — area: ledger — raised: bootstrap

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

- **Walking skeleton** — delivered in [slice 0001](slices/0001-walking-skeleton.md)
