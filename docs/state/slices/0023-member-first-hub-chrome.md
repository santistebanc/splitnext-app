# Slice 0023 — member-first hub chrome

**Tier** — polish · **Closed** — 2026-08-14 · **Tag** — `slice-0023`

## What shipped

The group hub is a member-first balance list. Tap a person to see their net and the transfers they would pay. Expenses live behind **All expenses**. **+ Expense** is a FAB. Same capabilities as before; new layout. Prototype leftovers (activity, settings, leave/kick, share buckets) stay parked.

## Report

### Headline
The hub is names and nets; settle moved onto the member you tap.

### Highlights
- **Balance list is home** — You highlighted; Invite / This is me as sibling chips (not nested buttons).
- **Member screen** — net + that person's outgoing settle buttons; tap still prefills via `settlementHref` (D-069).
- **All expenses** — the old hub list, pushed from the hub.
- **D-073** — member-first chrome. Tokens in `L-theme`; cents as text via `formatCents` (no float).

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Hub | Stacked members, balances, settle-up, expenses | One balance list, All expenses →, FAB + Expense |
| Settle | **Settle up** list on the hub | Outgoing transfers on `L-member` |
| Expenses | Listed on the hub | `/group/[id]/expenses` |
| Palette | Ad-hoc hex per screen | `L-theme` tokens |

### Surfaces touched

- **Client** — hub restack; `L-member`; `L-expenses`; tokens on lobby / join / expense-form / layouts
- **Server** — none
- **State** — `OVERVIEW.md`, `LOGIC.md`, `FLOWS.md`, this archive, `DECISIONS.md` (D-073), `PARKING.md`
- **Capture** — `capture-driver.mjs`, `capture-flows.mjs`, `capture_driver_test.py`; flow clips re-recorded

### Decisions this slice

- D-073 — Hub home is the balance list; a member's outgoing transfers live on that member's screen; expenses live behind All expenses. Settle tap still prefills via `settlementHref` (D-069).

### Logic delta

- **Added** — `L-member` · `L-expenses` · `L-settlementsForMember` · `L-theme` · `L-memberLabel`
- **Changed** — `L-hub` (balance list + FAB) · `L-settlementHref` (opened from the member screen) · `L-lobby` · `L-join` · `L-expenseNew` · `L-rootLayout` (tokens)

### Flow delta

- **Changed** — `F-add-expense` (FAB) · `F-balances` (hub is the list) · `F-settle` (open a member) · `F-settle-record` (button on `L-member`; Settlement listed on `L-expenses`) · `F-add-member` · `F-bind` · `F-invite` · `F-bump` (chrome) · clips re-recorded for every drivable hub flow

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-hub` | No members | Hint “add yourself first”; no FAB; add-member field still there. |
| `L-hub` | Members, no bind | Balance rows at 0.00; Invite + This is me chips; no FAB. |
| `L-hub` | Bound, no expenses | You highlighted; This is me gone on You; FAB **+ Expense** appears. |
| `L-hub` | Nested Invite / This is me | Chips are siblings of the row button, not children — web cannot nest `<button>`. |
| `L-member` | Member is owed (no outgoing transfer) | Net shows; settle block absent. |
| `L-member` | Member id missing from the store | Title “(unnamed)”; net 0; no settle. |
| `L-expenses` | Empty | Hint to add the first expense, or to tap This is me first if unbound. |
| `F-settle-record` | After save | Form returns to `L-member`; Settlement is listed on `L-expenses`, not the hub. |

### Review

- **Invariants** — `formatMoney` used `(cents / 100).toFixed(2)` (float). Fixed: `formatCents` uses `Math.floor` / `% 100`, same path as the expense form. D-067 / D-069 unchanged; D-073 records the chrome move.
- **Spec** — `settlementsForMember` tests match the three cases. `settleRowOf` is a Playwright locator, driven by F-settle / F-settle-record, not unit-tested (accepted). Capture does not assert the post-save route is still `L-member` (accepted: `router.back()` from the stack; it then opens All expenses). Out of scope kept. Extra vs After table, accepted as prototype matching: row scale by member count; hub ← back to lobby.
- **Standards** — chips are siblings of the row Pressable. Accepted: `balScale` lives on the hub; signed-amount colour cascade is copied on hub and member.

### Shots

- `0023-hub.png` — balance-list hub after a spent group
- `0023-member.png` — member screen with net + settle
- `0023-settle-prefill.png` — new-expense form opened from a settle button
- Re-recorded `flows/F-create.webm` · `F-open.webm` · `F-add-member.webm` · `F-bind.webm` · `F-add-expense.webm` · `F-balances.webm` · `F-settle.webm` · `F-settle-record.webm` · `F-bump.webm`

### Diff pulse

`+1016 / −386 · 34 files` — from `git diff --cached --stat` at close

## Questions asked and answered

- **Like the hub-chrome prototype?** → Yes, as the recommended cut (balance list + member settle + All expenses + FAB). Prototype leftovers are a series, not this slice.
- **Build the rest of the prototype?** → Park as future slices; start next on paid-for / owes-for buckets.

## What was parked during this slice

- Paid-for / owes-for buckets → PARKING (appetite: next after 0023)
- Activity burger drawer → PARKING
- ⚙ Settings (rename, currency) → PARKING
- Leave / kick → PARKING
- Expense editor as a sheet / edit existing → PARKING
- Invite sheet / invite-only-if-unjoined → PARKING

## Notes

Invite / This is me cannot nest inside the row `<button>` on web. Capture `--assert-only` against the deployed Worker always flags `workers.dev` requests; laptop clip recording omits that flag. Human capture this slice used `--url http://127.0.0.1:8082` because 8081 was already taken.
