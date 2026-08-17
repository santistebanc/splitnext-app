# Slice 0033 — kick member

**Tier** — foundation-risk · **Closed** — 2026-08-18 · **Tag** — `slice-0033`

## What shipped

Soft-delete an unclaimed member from member detail: **Remove member** → confirm drawer → tombstone at next version, sync via existing merge path. You and claimed slots have no Remove control. Hub and lobby drop the id; historical expenses stay.

## Report

### Headline
Member detail → Remove → confirm → member gone from hub lists.

### Highlights
- **`L-tombstoneMember`** — pure next-version tombstone (mirror `tombstoneExpense`).
- **`L-deleteMember`** — queue + flush one member item.
- **`L-member` UI** — Remove footer + `ConfirmDrawer`; hidden for You and claimed.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Remove member | Not possible | Unclaimed slot: Remove → confirm → tombstone |
| Hub / pickers | Live members only | Kicked member excluded |
| You / claimed | — | No Remove button |

### Surfaces touched

- **Client** — `L-tombstoneMember` · `L-deleteMember` · `L-member`
- **Server** — none (merge path only)
- **State** — `OVERVIEW.md`, `LOGIC.md`, `FLOWS.md`, `DECISIONS.md` (D-087), `PARKING.md`, this archive
- **Capture** — `F-kick-member`; re-recorded `F-rename`

### Logic delta

- **Added** — `L-tombstoneMember` · `L-deleteMember`
- **Changed** — `L-member` (Remove + confirm drawer)

### Flow delta

- **Added** — `F-kick-member`

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-tombstoneMember` | already tombstoned | Returns null. |
| `L-deleteMember` | missing id | No-op. |
| `L-member` | You or claimed | No Remove button. |
| `L-member` | confirmed remove | Tombstones, navigates to hub. |

### Review

- **Invariants** — Soft-delete only; version bump; expenses unchanged; integer cents unchanged.
- **Spec** — tombstone pure + delete job + member UI + capture. Force-kick claimed / allocation rewrite absent per out of scope.
- **Standards** — Mirrors expense-delete pattern; reuses `ConfirmDrawer`.

### Shots

- Recorded `flows/F-kick-member.webm`

### Diff pulse

Small vertical slice: domain tombstone, sync job, member screen footer, one flow.

## Questions asked and answered

- **Next slice after confirm drawer?** → Kick member.
- **Merge pending?** → Nothing on main; proceed.

## What was parked during this slice

- Activity entity, last-opened, invite landing, legal

## Notes

Kick is presentation-only risk reduction — balances already excluded tombstoned members from live folds (slice 0007).
