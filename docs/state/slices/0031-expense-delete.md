# Slice 0031 — expense delete

**Tier** — foundation-risk · **Closed** — 2026-08-18 · **Tag** — `slice-0031`

## What shipped

Soft-delete an expense from the edit form: header **Delete**, inline confirm, tombstone at next version, sync via existing merge path. Lists and balance folds already excluded `deleted_at`.

## Report

### Headline
Edit → Delete → confirm → expense gone from lists and hub nets.

### Highlights
- **`L-tombstoneExpense`** — pure next-version tombstone (mirror `tombstoneBind`).
- **`L-deleteExpense`** — queue + flush one expense item.
- **Edit UI** — header Delete, inline confirm like Leave in Settings.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Delete | No UI | Edit form: Delete → confirm → tombstone |
| Lists / nets | Already skip tombstones | Delete makes an expense invisible |

### Surfaces touched

- **Client** — `L-tombstoneExpense` · `L-deleteExpense` · `L-expenseNew` (header Delete + confirm)
- **Server** — none
- **State** — `OVERVIEW.md`, `LOGIC.md`, `FLOWS.md`, this archive, `PARKING.md`
- **Capture** — `F-delete-expense`

### Logic delta

- **Added** — `L-tombstoneExpense` · `L-deleteExpense`
- **Changed** — `L-expenseNew` (Delete on edit)

### Flow delta

- **Added** — `F-delete-expense`

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-tombstoneExpense` | already tombstoned | Returns null. |
| `L-deleteExpense` | missing expense id | No-op. |
| `L-deleteExpense` | second delete | No-op. |
| `L-expenseNew` | Delete confirmed | Tombstones, navigates back. |

### Review

- **Invariants** — Soft-delete only; version bump; no hard delete; integer cents unchanged.
- **Spec** — tombstone pure + delete job + edit UI + capture. Activity/undo/list swipe absent per out of scope.
- **Standards** — Inline confirm reuses Settings leave pattern; headerRight only in edit mode.

### Shots

- Recorded `flows/F-delete-expense.webm`

### Diff pulse

At close on branch (small delta on 0030).

## Questions asked and answered

- **Next slice after mixed splits?** → Expense delete.
- **Build it?** → Yes.

## What was parked during this slice

- Activity / undo / toast, kick, last-opened, invite landing, legal

## Notes

0030 merged as PR #34 before this branch was cut from `main`.
