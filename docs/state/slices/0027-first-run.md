# Slice 0027 — first-run

**Tier** — core-value · **Closed** — 2026-08-17 · **Tag** — `slice-0027`

## What shipped

Create group is a form (group name, your name, currency) that lands on a hub of names. Until the first expense the hub is names + Invite on unclaimed + add member; afterwards it is balances as before. Lobby lists groups by name. Assumed member is set at create or join and cannot be changed. Settings is name, currency, Done, and Leave group. Slice 0026’s Settings chrome never closed on its own; it ships here.

## Report

### Headline
You name the group and yourself on the way in, and you cannot retarget who you are afterwards.

### Highlights
- **Create is identity** — `/create` writes the group, you as a member, and this device’s bind, then opens the hub (D-077).
- **Hub of names** — no live expense → names, Invite on unclaimed, add member, no 0.00, no All expenses. First expense → balances, tap-to-detail, quiet Add member.
- **Bind once** — create or join only. A second member is `binding_locked`. Leave still unbinds (D-076).
- **Lobby** — groups by name with a one-line member list; Join with link expands, submits, collapses on blur.
- **Settings** — name, currency, Done, Leave at the bottom. No roster (D-078).

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Lobby | Create, always-on join paste, id list | Create group; name + members; quiet Join with link |
| Create | Empty group, opens Settings | Form then hub, named and bound |
| Hub (no expenses) | Balance rows at 0.00 | Names + Invite + add member; not clickable |
| Hub (has expenses) | Balances, tap opens detail | Same, plus quiet Add member; Invite on unclaimed detail |
| This is me | Chip until first expense (D-020) | Gone. Bind is once |
| Settings | (none on main) | Name, currency, Done, Leave |
| Leave | You-detail | Settings |

### Surfaces touched

- **Client** — `L-create` / `L-createGroup` / `L-createGroupDraft`; `L-bindOnce` / `L-bindMe`; `L-lobby` / `L-lobbyTitle` / `L-lobbyMembers`; `L-hub` names vs balances; `L-settings` / `L-patchGroup` / `L-updateGroup` / `L-settingsDone`; `L-member` Invite; `L-webFrame`
- **Server** — none
- **State** — `OVERVIEW.md`, `LOGIC.md`, `FLOWS.md`, this archive, `DECISIONS.md` (D-076–D-078), `PARKING.md`
- **Capture** — `F-create` · `F-open` · `F-add-member` · `F-add-expense` · `F-balances` · `F-settle` · `F-settle-record` · `F-leave` · `F-bump`; stills `0027-hub.png` / `0027-settings.png`; `F-bind` dropped

### Decisions this slice

- D-076 — Assumed member is set at create or join and cannot be changed. A second target is refused. Leave tombstones the bind so this install may bind again. Reverses D-020 and the re-point half of D-021.
- D-077 — Create group is a form (name, your name, currency) that writes the group, creator member, and this device’s bind, then opens the hub. Reverses D-011.
- D-078 — Settings is group name, currency, Done, and Leave group. No roster, no Invite, no add member. Leave’s unbind-then-revoke is still D-075; the surface moved off You-detail.

### Logic delta

- **Added** — `L-create` · `L-settings` · `L-webFrame` · `L-memberClaimed` · `L-bindOnce` · `L-patchGroup` · `L-createGroupDraft` · `L-lobbyTitle` · `L-lobbyMembers` · `L-settingsDone` · `L-updateGroup`
- **Changed** — `L-lobby` (name + members; quiet join) · `L-hub` (names then balances) · `L-member` (Invite; Leave gone) · `L-createGroup` (named + bound) · `L-bindMe` (`binding_locked`) · `L-bindingOpen` (no live expense, not This is me)
- **Removed** — `L-bumpName` (Settings `L-updateGroup` is the rename)

### Flow delta

- **Changed** — `F-create` (form then hub of names) · `F-open` (lobby title + members) · `F-add-member` (full field or quiet) · `F-add-expense` (hub switches to balances) · `F-bind` (create/join; no This is me; clip dropped) · `F-invite` (hub names or member detail) · `F-join` (quiet lobby field) · `F-bump` (Settings Done) · `F-leave` (Settings)
- **Changed** — clips re-recorded for every drivable flow this slice touched

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-create` | whitespace group name or your name | Submit stays off. |
| `L-createGroupDraft` | whitespace name or creator | Returns null; `L-createGroup` throws `create_invalid`. |
| `L-createGroupDraft` | empty currency | Currency is `EUR`. |
| `L-bindOnce` | no live bind | `'bind'`. |
| `L-bindOnce` | already that member | `'noop'`. |
| `L-bindOnce` | a different member | `'locked'`; `L-bindMe` records `binding_locked`. |
| `L-bindOnce` | tombstoned bind | Counts as no live bind. |
| `L-hub` | no live expense | Name rows, not pressable, Invite on unclaimed, add member on the hub; All expenses hidden. |
| `L-hub` | first live expense | Balances, tap opens `L-member`, All expenses; quiet Add member expands to a field. Invite on a name is gone. |
| `L-member` | unclaimed slot | **Invite** is shown; You and joined members do not get it. |
| `L-settings` | any | Group name, currency, Done; Leave group at the bottom. |
| `L-settings` | leave confirm cancelled | Writes nothing. |
| `L-settings` | leave failed | Stays on Settings; `leave_failed`; lobby not dropped. |
| `L-webFrame` | window narrower than 480px | No frame; the app fills the window, including capture's 420×900 viewport. |
| `L-webFrame` | window shorter than 900px | Frame stays 420×900; the body scrolls. |
| `L-lobby` | Join with link, blur without submit | Field collapses; the link is back. |
| `L-lobby` | group with a name and members | Row shows the name and a one-line member list, ellipsized if it does not fit. |
| `L-lobby` | unnamed group | Title is (empty). |
| `L-settings` | leftover unbound group | No This is me; Done stays off. |

### Review

- **Invariants** — No cents / version / soft-delete / Worker-door breaks. D-076–D-078 append rather than silently reversing D-011 / D-020 / D-021 / D-075’s surface. D-014 uniqueness and D-075 unbind-then-revoke still hold. D-023: `phoneFrame.ts` / `phoneFrame.web.ts`; CSS is `app/+html.tsx`.
- **Spec** — Seams `L-bindOnce` and `L-createGroupDraft` have tests; `F-create` asserts hub-of-names (Ana, Add member, no 0.00). Fixed leftover “add yourself first” copy. Accepted: `createGroup`’s `create_invalid` throw is the draft returning null; lobby join-blur is UI not a listed seam; two Done controls on Settings; `bindMe` has no UI caller after create/join.
- **Standards** — Hub title uses `lobbyGroupTitle`; `bindOnce` uses `assumedMemberIdFromBinds`; `createGroup` takes `CreateGroupDraftInput`. Dropped the duplicate `phoneFrame.css`. Accepted: Invite/copy still duplicated on hub and member; names vs balances still fork in one hub screen.

### Shots

- `0027-hub.png` — names hub after create (You, add member)
- `0027-settings.png` — name, currency, Done, Leave group
- Recorded `flows/F-create.webm` · `F-open.webm` · `F-add-member.webm` · `F-add-expense.webm` · `F-balances.webm` · `F-settle.webm` · `F-settle-record.webm` · `F-leave.webm` · `F-bump.webm`
- Dropped the F-bind clip — bind has no surface of its own

### Diff pulse

`+1718 / −544 · 43 files` — from `git diff --cached --stat` at close

## Questions asked and answered

- **Create empty then bind, or name yourself on the way in?** → Form with group name, your name, currency; hub opens bound (reverses D-011).
- **Can assumed member change?** → No. Once, at create or join. Rename and expense edit are how a typo or a split is fixed later.
- **Hub before the first expense?** → Names + Invite + add member, not 0.00.
- **Settings roster?** → No. Invite lives on the names hub or on unclaimed member detail. Leave lives on Settings.
- **Reactivate join link on leave?** → No; forget that.
- **Build it?** → Yes.
- **Close it?** → Yes.

## What was parked during this slice

- Rename any member + edit expenses → PARKING (appetite: next after 0027)
- Kick out → PARKING
- Invite active / expired / resend → PARKING
- Smooth member view transitions → PARKING
- Invite copy/share sheet → PARKING
- This is me drawer / change-anytime → dropped
- Reactivate join link on leave → dropped
- Leftover unbound groups from before this slice → no This is me recovery

## Notes

Slice 0026 (hub three-door / Settings) never closed. Its Settings chrome is the foundation 0027 sits on; one PR, tag `slice-0027`. `0014-cloudflare-do.md` no longer claims `F-bind.webm` because that clip was dropped with the surface.
