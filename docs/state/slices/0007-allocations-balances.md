# Slice 0007 — allocations + balances

**Tier** — core value (foundation-risk in the merge shape) · **Closed** — 2026-08-07 · **Tag** — `slice-0007`

## What shipped

An expense now records *who owes*, not only who paid. The split rides inside the expense entity, so one version number covers the whole thing, and the hub folds those splits into each member's net position. The board also gained real evidence: `npm run capture` drives the web target through every flow and leaves a clip beside each one.

## Report

### Headline
The ledger closes: every expense carries a split that sums to its total, and the hub says who is up and who is down.

### Highlights
- **Allocations live inside the expense.** One entity, one version, one merge — a device can never accept a new amount while rejecting one of its shares. The alternative (child rows per share) would have needed a transaction the entity-level merge does not have.
- **The split is deterministic across devices.** Members are deduped and id-sorted, the base share goes to everyone, and leftover cents go out one at a time in that order. Two devices holding the same roster in different insertion orders produce the same allocations byte for byte, so merge cannot flap between two equally valid answers.
- **The split is frozen at record time.** A member added later joins the next expense, not this one.
- **Balances are derived, never stored.** `computeBalances` folds live members over live expenses; nothing to keep in sync, nothing to migrate.
- **A latent crash was found and fixed.** Legend's parser revives exact ISO-8601 strings into `Date` objects on reload, so `updated_at` came back a different type than it went in. A one-expense group never called the sort comparator, so the bug hid from slice 0006 until a second expense existed. `L-normalizeTimestamps` repairs the store at open — including stores persisted by older builds.
- **Flow clips.** Seven flows record end to end against the deployed Edge Functions, with a drawn pointer so a viewer can see what is being touched. The script asserts as well as records: clean console, and balances identical across a reload.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Expense | `payer_member_id` + `amount_cents`; who owes unmodelled | `allocations: [{member_id, amount_cents}]` on the same entity |
| Split | — | Equal across live members at record time, largest-remainder, id-ordered |
| Hub | Members + expenses | Balances section above expenses; each expense row says how many ways it split |
| Store open | Whatever Legend revived | `L-normalizeTimestamps` runs before anything reads |
| Board evidence | Two stills | A clip per drivable flow + a balances still, regenerable by `npm run capture` |

### Logic delta

- **Added** — `L-splitEqually` (divide a cost to the cent, same answer on every device) · `L-balances` (what each member is up or down) · `L-normalizeTimestamps` (undo the Dates a reload invents)
- **Changed** — `L-addExpense` (splits across live members and freezes it in) · `L-getGroupStore` (normalizes on open) · `L-hub` (balances section, split count per row)

### Flow delta

- **Added** — `F-balances` (open a group and read the net positions).
- **Changed** — `F-add-expense` gained the split step; `F-open` gained the normalize step ahead of everything else.

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| Balances | expense recorded before this slice (no `allocations`) | Payer credited, nobody debited, so the visible list does not net to zero. Honest over invented: re-splitting now would attribute a debt the expense never recorded. |
| Balances | allocation names a member this device has not pulled yet | The share is skipped rather than shown against a blank row; the roster pull that follows corrects it. |
| Balances | member soft-deleted after being allocated | Their row, their debt and their paying all leave the fold, so the group no longer nets to zero. No UI reaches this today — member delete is parked — but the fold does not crash on it. |
| `splitEqually` | duplicate ids in the roster | Deduped before splitting, so a doubled member cannot be charged twice. |
| `splitEqually` | amount smaller than the member count (2c across 5) | The first two by id owe a cent each, the rest owe nothing. Every cent is still allocated. |
| `L-addExpense` | group has exactly one member | That member pays and owes the whole amount; net zero, which is correct. |
| Hub | no expenses yet | "Nothing spent yet — everyone is square" rather than a list of zeros, so an empty group reads as empty rather than broken. |
| Hub | reopened with two or more expenses | **Crashed the whole screen** until fixed — see `L-normalizeTimestamps` above. Latent since the persist work in 0006 and invisible with one expense, because a one-item sort never calls the comparator. |
| `L-getGroupStore` | store persisted before this slice | Normalized on open, so a device carrying Dates from an older build is repaired rather than left to crash. |
| `L-edgeFetch` | wake naming an expense, stale `fetch-entity` deployed | 400 `unsupported` surfaced as `fetch_failed` on the hub and the wake was dropped; the next roster pull still caught up. Fixed by deploying the function, not by code. |

### Shots

- `shots/flows/F-create.webm`, `F-open.webm`, `F-add-member.webm`, `F-bind.webm`, `F-add-expense.webm`, `F-balances.webm`, `F-bump.webm` — one per drivable flow, overwritten in place when a flow's behaviour changes.
- `shots/0007-balances.png` — three members, two expenses, nets summing to zero with You (Name) marked.
- Not capturable: `F-sync` (no surface of its own — it runs inside `F-open`), `F-foreground` (needs the app backgrounded and returned to), `F-wake` (needs a second device changing the group). The capture script names and explains each rather than dropping them silently.

### Surfaces touched

- **Client** — `src/domain/split.ts`, `src/domain/balances.ts`, `src/store/timestamps.ts`, `src/store/groupStore.ts`, `src/sync/groupSync.ts`, `src/types/group.ts`, `app/group/[id].tsx`
- **Server** — `supabase/migrations/20260806013000_expense_allocations.sql`, `supabase/functions/_shared/entities.ts` (`EXPENSE_SELECT` + `expenseRow`)
- **Tooling** — `docs/scripts/capture-flows.mjs`, `capture-driver.mjs`, `capture-overlay.mjs`, `npm run capture`, Playwright devDependency, `.gitattributes` for shot binaries
- **State** — `OVERVIEW.md`, `LOGIC.md`, `FLOWS.md`, `PARKING.md`, `docs/state/shots/`, `docs/scripts/generate-slicer-board.py`

### Decisions this slice

- D-024 — Allocations ride inside the expense entity, not as child rows
- D-025 — Equal split with id-ordered remainder, frozen at record time
- D-026 — Balances are derived on read, never stored
- D-027 — Persisted timestamps are repaired at store open rather than by changing the persisted format

### Diff pulse

`+1606 / −113 · 36 files` — 25 files and `+1558 / −113` excluding generated board output and lockfile

## Questions asked and answered

- **Allocations inside the expense or as their own entity?** → Inside. One version covers the split, so it cannot half-apply through merge.
- **Equal split only, or the participant picker now?** → Equal only. The picker needs an expense editor, which is parked; splitting equally proves the invariant and the fold without it.
- **Backfill allocations onto the 0005 demo expenses?** → No. Inventing a split the expense never recorded is worse than a list that visibly does not net to zero.
- **Where does the `Date` revival get fixed — the persisted format or on open?** → On open. Changing the format leaves every already-persisted store broken; normalizing repairs them.

## What was parked during this slice

- **Deploy drift between local and remote** — the remote was missing the whole `expenses` table and carried a stale `fetch-entity`, three slices after 0005 said both shipped. Nothing checks that what is committed is what is deployed → PARKING (foundation-risk)

## Notes

**`allocationsSumTo` was written, then deleted at review.** `splitEqually` allocates every cent by construction and the tests prove it over the whole small-amount space, so the check in `addExpense` could not fire — and it threw where its neighbours set `lastError`, into a caller with no catch. Dead defence that would have failed badly on the day it did fire. The invariant it named is still asserted, directly, in `split.test.ts`.

**`allocations` is optional on the type.** Persisted-before-0007 expenses genuinely have no such field, and the readers already guarded for it; declaring it required would have made the guards read as dead code and the type read as a lie.

**The round trip through `merge` → `list-roster` is proven by the capture run, not by a unit test.** The flows drive the real deployed functions, so an unmigrated column or a stale function fails the run. A contract test against a local stack is still parked — and `supabase db dump` needs Docker, which this machine does not have, so the remote schema cannot be diffed locally today.
