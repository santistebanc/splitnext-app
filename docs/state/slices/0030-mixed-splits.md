# Slice 0030 — mixed splits

**Tier** — foundation-risk / core value · **Closed** — 2026-08-18 · **Tag** — `slice-0030`

## What shipped

Unequal splits on the add/edit expense form: share units (+/-), tap amount for fixed cents, `allocateMixed` for integer allocations. Edit restores intent; pre-0030 cents-only rows open as 1 share each. Form chrome: Paid by drawer (label + field one row), large amount (focused on create), What for last.

## Report

### Headline
2× shares or a fixed slice on one expense; hub nets match; edit brings the same controls back.

### Highlights
- **`L-allocateMixed` / `L-splitEditor`** — v1 split math and editor transitions ported; GCD-normalized share units; at least one non-fixed share member remains.
- **Stored intent** — allocations carry `share_units` and optional `fixed_cents`; `L-patchExpense` rebuilds via mixed intent (D-085).
- **Form** — `ExpenseSplitList` (+/-, fixed edit); `PayerSelect` drawer; `ExpenseAmountInput` (v1-style large amount).

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Who shares | Checkbox; always 1 share | +/- shares; tap amount for fixed |
| Allocations | `{ member_id, amount_cents }` equal | Also `share_units` / `fixed_cents`; cents from `allocateMixed` |
| Edit | Equal among checked | Restores shares and fixed; cents-only legacy → 1 share each |
| Paid by | Radio list | Drawer (currency shape); label + field one row |
| Amount | Bordered text field | Large centered amount; autofocus on create only |
| What for | Above split list | Last field before Save |

### Surfaces touched

- **Client** — `L-allocateMixed` · `L-splitEditor` · `L-patchExpense` / `L-addExpense` / `L-updateExpense` · `L-expenseNew` · `ExpenseSplitList` · `PayerSelect` · `ExpenseAmountInput`
- **Server** — none (merge accepts extended allocation payload)
- **State** — `OVERVIEW.md`, `LOGIC.md`, `FLOWS.md`, this archive, `DECISIONS.md` (D-085), `PARKING.md`
- **Capture** — `F-mixed-split`; re-recorded expense/settle flows; stills `0030-hub.png` / `0030-split.png`

### Decisions this slice

- D-085 — Allocation stores share intent; `allocateMixed` derives cents; equal 1-share is the default editor state.

### Logic delta

- **Added** — `L-allocateMixed` · `L-splitEditor`
- **Changed** — `L-splitEqually` (equal case of mixed) · `L-patchExpense` · `L-addExpense` · `L-updateExpense` · `L-expenseNew` (mixed editor, payer drawer, amount chrome, field order)

### Flow delta

- **Added** — `F-mixed-split`
- **Changed** — `F-add-expense` · `F-edit-expense` (form layout and split editor)

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-splitEditor` | last share member decreased | Stays 1 share (`ensureShareMember`). |
| `L-splitEditor` | fixed cleared / 0 | Returns to 1 share. |
| `L-splitEditor` | fixed equals remaining pool | Others' shares go to 0. |
| `L-allocateMixed` | fixed ≥ total | Share members get 0; sum still equals expense. |
| `L-patchExpense` | pre-0030 cents-only allocations | Hydrate as 1 share, no fixed. |
| `L-expenseNew` | settle prefill | One participant, 1 share (unchanged). |
| `L-expenseNew` | create | Amount field autofocuses; edit does not. |
| `L-expenseNew` | edit, members land before expense | Split hydrates from stored allocations keyed on `hydratedId`. |

### Review

- **Invariants** — Integer cents throughout; allocations stay inside the expense (D-024); version bump on edit; soft-delete unchanged; no client→D1/DO. D-085 narrows D-083/D-025 for mixed intent without reversing them.
- **Spec** — Mixed editor, `allocateMixed`, patch/add/update with splitAmong, `F-mixed-split`, tests at the three seams. Out-of-scope items (delete, activity, kick, sheet) absent.
- **Standards** — Accepted: form chrome iterations (payer row, amount, What for order) in-slice per user steering. Accepted: `parseCents` stays on the screen; sanitize lives in `ExpenseAmountInput`. No god-file growth beyond the form screen.

### Shots

- `0030-hub.png` — hub with balances after mixed expense
- `0030-split.png` — new-expense form with Paid by row and large amount
- Recorded `flows/F-mixed-split.webm`; re-recorded `F-add-expense`, `F-edit-expense`, and settle/balance clips after form changes

### Diff pulse

`+432 / −183 · 18 tracked files` plus new: `allocateMixed`, `splitEditor`, `ExpenseAmountInput`, `PayerSelect`, `expenseSplitList`, `F-mixed-split.webm`, stills — at close (uncommitted on branch)

## Questions asked and answered

- **Do as v1?** → Yes — editor transitions + `allocateMixed`, this app's form surface.
- **Paid by / amount / What for layout?** → Paid by drawer top (label inline); large amount; What for last; amount focused on create.
- **Close it?** → Yes (demo approved).

## What was parked during this slice

- Expense delete, kick, activity/toast/push, pending badge, last-opened, invite landing, legal
- Multi-payer contributions, sheet chrome, create-roster / group invite / rebind

## Notes

Form chrome (payer drawer, amount field, field order) landed in the same slice as mixed splits — user steering during demo, not a separate slice.
