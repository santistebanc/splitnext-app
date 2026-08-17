# Slice 0029 — expense editor

**Tier** — core-value · **Closed** — 2026-08-17 · **Tag** — `slice-0029`

## What shipped

An existing expense can be changed from All expenses or a member bucket line. A wrong amount, payer, or who-shares is an edit (next version, same id), not a second expense. The split stays equal among the checked live set.

## Report

### Headline
Open an expense, change it, save — same id, new equal split, nets and buckets refold.

### Highlights
- **Equal-split edit** — `L-patchExpense` / `L-updateExpense` rebuild allocations via `L-participantsForSplit` + `L-splitEqually`. Unchanged fields (trim-equal description included) write nothing.
- **Same form as add** — All expenses rows and member bucket lines open `/expense/{id}`; Save writes the next version. Add is unchanged.
- **Whole expense** — a bucket line edits the expense, not one person’s share. Live members who were not in the original split stay unchecked.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| All expenses | Rows are display-only | A row opens the form filled from that expense |
| Bucket line | Display-only | Opens the same form for that whole expense |
| Stored expense | Frozen after add | Next version: amount, payer, who shares, description; allocations rebuilt equally |
| Uneven / custom amounts | (none) | Still none |
| Add | `L-expenseNew` | Unchanged |

### Surfaces touched

- **Client** — `L-patchExpense` / `L-updateExpense`; `L-expenseNew` dual-mode (`expense/[expenseId]`); `L-expenses` rows; `L-member` bucket `onOpen`; `expenseEditHref`
- **Server** — none
- **State** — `OVERVIEW.md`, `LOGIC.md`, `FLOWS.md`, this archive, `DECISIONS.md` (D-083), `PARKING.md`
- **Capture** — `F-edit-expense`; stills `0029-hub.png` / `0029-expenses.png` / `0029-edit.png`; `F-add-expense` re-recorded (heading insert made the clip look stale)

### Decisions this slice

- D-083 — An expense is editable at the next version. Allocations are rebuilt equally among the checked live set (D-068 / D-025). Same id; bind and other expenses stay. Unparks D-076's edit-expenses clause.

### Logic delta

- **Added** — `L-patchExpense` · `L-updateExpense`
- **Changed** — `L-expenseNew` (edit mode on `/expense/{id}`; Save) · `L-expenses` (row opens edit) · `L-member` (bucket line opens that expense)

### Flow delta

- **Added** — `F-edit-expense`
- **Changed** — `F-add-expense` (clip refresh after the new flow heading)

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-patchExpense` | unchanged after trim | Returns null. |
| `L-patchExpense` | participant set empty or names a missing member | Does not build a version (`L-participantsForSplit` already refuses). |
| `L-patchExpense` | amount not positive cents, or payer not live | Returns null. |
| `L-updateExpense` | missing or tombstoned expense | Does not write. |
| `L-expenseNew` | opened to edit | Fields come from the stored expense; live members not in the original split are unchecked. Save is **Save**. |
| `L-expenseNew` | edit, amount not positive cents | Save stays off, same as add. |
| `L-expenseNew` | edit, fields unchanged | Save stays off (`L-patchExpense` is null). |
| `L-expenseNew` | edit, members land before the expense | Sharing waits until amount/payer hydrate; the stored allocations win, not everyone. |

### Review

- **Invariants** — No cents / version / soft-delete / Worker-door / D-024 / D-025 breaks. Allocations stay inside the expense; equal split uses the existing helpers (D-068). Added D-083 so D-076's "edit expenses" clause is unparked in a decision, not only in parking prose.
- **Spec** — `L-patchExpense` tests match the seam table (including invalid amount / missing payer). Parked uneven splits, sheet chrome, and expense tombstone are absent. Capture `F-edit-expense` exists.
- **Standards** — Fixed: share-set hydrate raced `memberList` vs `editing` (`if (sharing != null) return` skipped allocations when the add-path default had already run). Amount/payer/sharing now hydrate together keyed on `hydratedId`. Accepted: add and edit share `L-expenseNew` (NEXT said the same form; a sheet is parked). Accepted: `updateExpense` takes the same field bag as `addExpense` rather than a second type — one write shape. Renamed the dry-run `nextVersion` to `draft`.

### Shots

- `0029-hub.png` — hub after an expense exists (balances + View all expenses)
- `0029-expenses.png` — All expenses list, rows tappable
- `0029-edit.png` — form filled from a stored expense; Save
- Recorded `flows/F-edit-expense.webm` and re-recorded `flows/F-add-expense.webm`

### Diff pulse

`+502 / −24 · 21 files` — from `git diff --cached --stat` at close

## Questions asked and answered

- **What can you change?** → Amount, payer, who shares, description; split stays equal (D-068).
- **From where?** → All expenses row or a member bucket line; both open the whole expense.
- **Same form as add?** → Yes; Save instead of Add expense. Sheet parked.
- **Unchanged Save?** → Off; `L-patchExpense` returns null.
- **Close it?** → Yes.

## What was parked during this slice

- Uneven / share-based splits
- Expense editor as a sheet
- Soft-delete an expense
- Kick / unique names / invite resend / copy-share sheet
- `splitnext.online` short origin

## Notes

0029 was first branched off `main` while 0028 was still open; restacked onto 0028, then onto merged `main` (`a0cf633`) so hub chrome from 0028 stayed. Uneven splits remain the parked half of this parking item.
