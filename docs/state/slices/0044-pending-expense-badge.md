# Slice 0044 — pending expense badge

**Tier** — breadth · **Closed** — 2026-08-19 · **Tag** — `slice-0044`

## What shipped

All expenses shows **Pending** on a row while that expense id is still in the outbound queue.

## Report

### Headline
Queued expenses are labelled on All expenses until the server accepts them.

### Highlights
- **`L-expenseIsPending`** — true when the queue holds any `expenses` item with that id.
- **`L-expenses`** — amber **Pending** on the subline; accessibility label includes “pending”.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| All expenses row | Description, payer, amount | Same, plus **Pending** while queued |
| Accepted expense | — | No mark |

### Surfaces touched

- **Client** — `L-expenseIsPending` · `L-expenses` · `L-queuePolicy`
- **State** — `OVERVIEW.md`, `LOGIC.md`, `FLOWS.md`, `DECISIONS.md` (D-099), `PARKING.md`, this archive

### Decisions this slice

- D-099 — Pending means the expense id is still in the outbound queue; shown on All expenses only. Hub, buckets, and other entities stay unbadged. Narrows D-084 pending badge.

### Logic delta

- **Added** — `L-expenseIsPending`
- **Changed** — `L-expenses`

### Flow delta

- **Changed** — `F-add-expense` (All expenses may show Pending until flush) · `F-edit-expense` (same while a new version is queued)

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-expenseIsPending` | two versions of same expense queued | true |
| `L-expenseIsPending` | member queued, not expense | false |
| `L-expenses` | queue empty | no Pending labels |

### Review

- **Invariants** — Queue identity unchanged (`entity_type + id + version`); money still integer cents; no new sync paths.
- **Spec** — Matches NEXT.md: seam tested; badge on All expenses only; hub, buckets, mute, store listings, descenders, hub-as-shell stayed out.
- **Standards** — Pure predicate on existing queue shape; screen reads queue via Legend and calls the seam.

### Shots

- No new capture clip (Pending needs offline or a slow flush; behaviour is a subline label).

## What was parked during this slice

- Pending on hub, member buckets, or expense form
- Invite status / resend
- Store listings
- Hub name descenders
- Hub-as-shell

## Notes

Fast networks may show Pending only briefly after Save.
