# Slice 0040 — undo on activity

**Tier** — foundation-risk · **Closed** — 2026-08-18 · **Tag** — `slice-0040`

## What shipped

The actor can Undo their own add, delete, or kick from the Activity page. The job restores or tombstones from `undo_snapshot` on that activity, then hides the event.

## Report

### Headline
Delete an expense → Activity **Undo** → expense is live again; add → **Undo** → expense gone. Someone else's line has no control.

### Highlights
- **`L-planUndo`** — restore delete/kick; tombstone an add; refuse foreign, stale, or missing snapshot.
- **`L-undoActivity`** — applies the plan, queues entity then activity, flushes.
- **`L-activityRow`** — **Undo** on the Activity page when `canUndo`.
- **Worker** — additive `undo_snapshot` on activities; `activityRow` round-trips JSON.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Delete / kick / add | Permanent from the UI | Actor can Undo on that activity line |
| Activity entity | Kind + ids only | Optional `undo_snapshot` of the target before the job |
| Confirm copy | “cannot be undone yet” | Points at Activity undo |

### Surfaces touched

- **Client** — `L-planUndo` · `L-undoActivity` · `L-activityRow` · `L-activity` · `L-addExpense` · `L-deleteExpense` · `L-deleteMember` · `L-formatActivityLine` · `L-expenseNew`
- **Server** — activities `undo_snapshot`; `activityRow` / `parseUndoSnapshot`
- **State** — `OVERVIEW.md`, `LOGIC.md`, `FLOWS.md` (`F-undo`), `DECISIONS.md` (D-095), `PARKING.md`, this archive
- **Capture** — `F-undo`

### Logic delta

- **Added** — `L-planUndo` · `L-undoActivity`
- **Changed** — `L-activity` · `L-activityRow` · `L-addExpense` · `L-deleteExpense` · `L-deleteMember` · `L-formatActivityLine` · `L-activityForExpenseAdded` · `L-activityForExpenseDeleted` · `L-activityForMemberKicked` · `L-expenseNew`

### Flow delta

- **Added** — `F-undo`

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-planUndo` | not the actor | null |
| `L-planUndo` | no snapshot (old events) | null |
| `L-planUndo` | add, then someone edited | null |
| `L-planUndo` | activity already tombstoned | null |
| `L-activity` | foreign line | No Undo control |

### Review

- **Invariants** — Money stays integer cents (snapshot is the expense entity). Conflicts still version-not-timestamp; restore writes `current.version + 1`. Soft-delete only (activity and add-undo tombstone). Clients still talk to the Worker, not D1/DO. Allocations stay inside the expense (D-024) because the snapshot is the whole entity. Splits unchanged (D-025). D-095 records actor-only Activity undo; does not reverse an earlier decision.
- **Spec** — Matches NEXT.md: add/delete/kick only; Activity page only; stale add refuses; foreign line has no Undo. Invite landing and legal stayed parked.
- **Standards** — `planUndo` is the pure seam; `activityRow` is the persist seam. Jobs stay thin (`undoActivity` applies the plan). Undo is not on the hub (no `onUndo` there).

### Shots

- `flows/F-undo.webm`

## What was parked during this slice

- Undo of edit / rename
- Undo on the hub recent list
- Join/leave/group-rename activity kinds
- Invite landing, legal

## Notes

D-095: events recorded before this slice have no snapshot and cannot undo.
