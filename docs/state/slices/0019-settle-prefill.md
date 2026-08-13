# Slice 0019 — Settle-up prefill

**Tier** — core-value · **Closed** — 2026-08-13 · **Tag** — `slice-0019`

## What shipped

Tapping a settle-up row opens the new-expense form already filled for that transfer. Save records it like any other expense; Back abandons. The tap itself does not move money.

## Report

### Headline
Settle-up stopped being a suggestion you type by hand: tap the row, check the form, Add expense.

### Highlights
- **`L-expensePrefill`** — query `{ payer, amount, participants, what }` → form values, or `null` if a required piece is missing or not integer cents.
- **`L-settlementHref`** — same settlement, same path, amount in cents, `what=Settlement`.
- **`L-hub`** — every settle row is tappable (any device, bound or not). No alert.
- **D-069** — tap opens the form; recording is still `addExpense`. Narrows D-067 without touching derived-not-stored.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Settle-up row | Inert (D-067) | Opens `L-expenseNew` with that transfer filled in |
| Record a settlement | Uncheck everyone but one, type the amount | Tap the row, **Add expense** |
| Add expense (no params) | You paid, everyone shares | Unchanged |
| Confirm before record | Parked as an alert | The form is the confirm |

### Surfaces touched

- **Client** — `src/domain/expensePrefill.ts`, `app/group/[id]/index.tsx`, `app/group/[id]/expense/new.tsx`; `src/sync/groupSync.ts` / `src/api/edge.ts` (create no longer waits on the wake socket; Worker POSTs abort after 15s)
- **Capture** — `docs/scripts/capture-flows.mjs`, `capture-driver.mjs`
- **State** — `LOGIC.md`, `FLOWS.md`, `OVERVIEW.md`, this archive, `DECISIONS.md` (D-069; D-066 and D-067 restored to the table), `PARKING.md`

### Decisions this slice

- D-069 — Tapping a settle-up row opens the new-expense form prefilled; the tap does not record or move money. Recording is still `addExpense`. Narrows D-067's "rows do nothing".

### Logic delta

- **Added** — `L-expensePrefill` · `L-settlementHref`
- **Changed** — `L-hub` (settle rows tappable) · `L-expenseNew` (query prefill) · `L-createGroup` (does not wait for the wake socket)

### Flow delta

- **Added** — `F-settle-record` (tap a row, save the prefilled expense)
- **Changed** — `F-settle` (step 3: tap opens the form; does not record)

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-expensePrefill` | missing payer, non-integer / non-positive `amount`, or empty `participants` | `null` — form uses You / everyone defaults |
| `L-expensePrefill` | extra commas / duplicate participant ids | unique ids, still ok if ≥1 remain |
| `L-expensePrefill` | `what` omitted | empty string; required pieces still prefill |
| `L-settlementHref` | two devices, same settlement | same href (member ids + cents, not display names) |
| `L-expenseNew` | valid prefill, this device has no bind | payer is still `from`; the You default does not win |
| `L-expenseNew` | junk params so prefill is `null` | You / everyone defaults, same as **Add expense** |
| `L-expenseNew` | Back | nothing recorded; settle list unchanged |
| `L-expenseNew` | hub stays mounted under the form | the hub's settle rows and **Add expense** are in the DOM but not visible; taps must hit the visible control |
| `L-hub` | this device has no bind | settle rows still open the form; hub **Add expense** stays hidden |
| `L-bindingOpen` | unbound device saves the prefilled expense | first expense closes **This is me**; this device still has no assumed member |
| `L-createGroup` | wake socket hangs on Expo Go | create still returns and the hub opens; subscribe continues in the background |
| `L-edgeCreate` | Worker fetch never returns | aborted after 15s as `edge_create-group_timeout`; spinner stops |

### Review

- **Invariants** — no violations. Integer cents in the query and in `formatCents`; tap does not write; save is still `addExpense`. D-069 names the narrowing of D-067 rather than quietly reversing "rows do nothing".
- **Spec** — both seams tested. Out of scope kept (no alert, no editor, no uneven splits, no tolerance). Extra: create no longer awaits wake, and every Worker POST aborts after 15s — accepted because Expo Go Create group hung forever on the socket and blocked the phone demo of this slice; one HTTP seam is the right place for the timeout.
- **Standards** — `expensePrefill.ts` is the new seam, not a fatter hub. Accepted: private `one()` for Expo's `string | string[]` query values; capture asserts Settlement on both `F-settle` and `F-settle-record`.

### Shots

- `0019-settle-prefill.png` — form after tapping `Bo → You (Ana)`: Bo paying, only You checked, 3.33, What for Settlement.
- Re-recorded `flows/F-settle.webm`. New `flows/F-settle-record.webm`.

### Diff pulse

`+405 / −44 · 17 files` — from `git diff --cached --stat` at close

## Questions asked and answered

- **Recommended pick?** → Settle-up prefill the 0018 form (not edit-existing, not uneven splits).
- **Any device, any row?** → Yes, bound or not.
- **Confirm first?** → No; tap opens the form. Back abandons. Save is the commit.

## What was parked during this slice

- Edit an existing expense → PARKING (core value)
- Uneven / share-based splits → PARKING (core value)
- Transaction tolerance → PARKING (polish)
- Confirm-before-record on a settle tap → dropped; the form is the confirm

## Notes

Nested stack still keeps the hub mounted under the form. Capture taps the visible settle row (`Name → Name`) and the visible **Add expense**. Expo Go Create group hung because create awaited `startWakeSubscription`; the 8s fail-safe never ran if the WebSocket constructor itself stalled.
