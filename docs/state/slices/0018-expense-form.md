# Slice 0018 — New expense form

**Tier** — core-value · **Closed** — 2026-08-13 · **Tag** — `slice-0018`

## What shipped

Recording an expense is its own screen: who paid, how much, and who shares equally among the selected members. Default is You paid and everyone shares. A one-person share is the settlement shape.

## Report

### Headline
Add expense left the hub for a form that can split among some of the group, not only all of it.

### Highlights
- **`L-participantsForSplit`** — selected ids must all be live and at least one; a missing member is refused, not dropped.
- **`L-expenseNew`** — `/group/[id]/expense/new`: payer, amount, who shares; save disabled without those.
- **`L-addExpense`** — splits the selected set; omitted participants still means all live; payer need not share.
- **D-068** — D-025's remainder, sort, and freeze apply to the selected set.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Add expense | Amount + description inline on the hub; always everyone live | Hub **Add expense** opens the form; payer and who shares are chosen there |
| Split set | All live members at record time (D-025) | Members selected at record time; default all live (D-068) |
| One-person share | Only if the group has one member | Uncheck everyone but Ana → Ana owes the whole amount |

### Surfaces touched

- **Client** — `src/domain/split.ts`, `src/sync/groupSync.ts`, `app/group/[id]/index.tsx`, `app/group/[id]/expense/new.tsx`, `app/group/[id]/_layout.tsx`, `app/_layout.tsx`
- **Capture** — `docs/scripts/capture-flows.mjs`, `capture-driver.mjs` (taps hit the visible control; nested stack keeps the hub mounted)
- **State** — `LOGIC.md`, `FLOWS.md`, `OVERVIEW.md`, this archive, `DECISIONS.md` (D-068), `PARKING.md`

### Decisions this slice

- D-068 — Equal split is over the members selected at record time (default all live); payer need not be in the set.

### Logic delta

- **Added** — `L-participantsForSplit` · `L-expenseNew`
- **Changed** — `L-addExpense` (selected set) · `L-hub` (button, not inline fields; file moved) · `L-splitEqually` (one-participant case named)

### Flow delta

- **Changed** — `F-add-expense` (opens the form, then splits the checked set)

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-participantsForSplit` | empty selection | `{ ok: false, reason: 'empty' }` — `L-addExpense` sets `member_missing`, stores nothing |
| `L-participantsForSplit` | selected id not in the live set | `{ ok: false, reason: 'member_missing' }` — the rest are not kept |
| `L-participantsForSplit` | same id twice | once |
| `L-splitEqually` | one participant | that member owes the whole amount |
| `L-addExpense` | `participantMemberIds` omitted | every live member, same as before this slice |
| `L-addExpense` | payer is not in the share set | stored; allocations name only the sharers |
| `L-expenseNew` | this device has no bind | no default payer; Save stays disabled until someone is picked |
| `L-expenseNew` | every share row unchecked | Save disabled |
| `L-expenseNew` | `addExpense` returns '' | stay on the form; `lastError` shows |
| `L-expenseNew` | second tap while saving | ignored (`busy`) |
| `L-hub` | this device has no bind | **Add expense** hidden; same hint as before |
| `L-expenseNew` | hub stays mounted under the form | the hub's **Add expense** is in the DOM but not visible; taps must hit the visible one |

### Review

- **Invariants** — no violations. Integer cents; allocations still inside the expense (D-024); `splitEqually` still sorts and hands remainder by id. D-068 names the selected-set rule so D-025 is not quietly reversed.
- **Spec** — seams covered. Out of scope kept (no editor, no uneven splits, no settle-up prefill, no query params). Accepted: re-recorded `F-open` / `F-settle` / `F-bump` because hub chrome changed; no subset clip (optional in the plan).
- **Standards** — `participantsForSplit` is the new seam; the form is a screen, not a fatter hub. Accepted: You-label and roster sort copied on the form, matching other screens. Capture `visible: true` filter is the nested-stack fix, not a demo hack.

### Shots

- `0018-expense-form.png` — new-expense form, You paying, everyone checked.
- Re-recorded `flows/F-add-expense.webm`, `flows/F-balances.webm`, `flows/F-open.webm`, `flows/F-settle.webm`, `flows/F-bump.webm`.

### Diff pulse

`+501 / −98 · 21 files` — from `git diff --cached --stat` at close

## Questions asked and answered

- **New-expense form only, or edit-existing too?** → Add form only. Edit-after stays parked.
- **Own screen or stay on the hub?** → Own route `/group/[id]/expense/new`.
- **Settle-up → record now?** → No; do the form first so settle-up can open it prefilled later. Any row, confirm first — parked.

## What was parked during this slice

- Settle-up → prefill this form (payer=`from`, participants=`[to]`, amount); any device, confirm first → PARKING (core value)
- Edit an existing expense → PARKING (core value)
- Uneven / share-based splits → PARKING (core value)

## Notes

Nested stack keeps the hub mounted under the form, so two **Add expense** texts exist in the DOM. Capture taps the visible one. Screen title is **New expense** so the header is not a third copy of the button label.
