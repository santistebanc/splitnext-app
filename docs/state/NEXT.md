# Slice 0005 — expense spine

**Tier** — core value

## Goal

Record a shared cost and watch it sync: an expense with a payer and an amount, added from the hub, flushed through the same merge path as members and binds. First ledger surface — the reason the sync spine exists. Balances stay out of scope; this slice proves an expense survives the round trip.

## Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Ledger | Nothing to record | Add expense: payer, amount, description |
| Entities synced | `groups`, `members`, `binds` | + `expenses`, through the same `L-edgeMerge` path |
| Money | Not represented | Integer cents; no floats anywhere |
| Hub | Members list | Members list + expenses list, newest first |
| Server | Three tables | + `expenses`, deny-all RLS, same version rule |

## Plan

1. `expenses` migration; widen `L-efMerge` / `L-efFetch` / `L-efRoster` to carry the new entity type; deploy.
2. Expense entity in `src/types/group.ts`. `L-sortByFlushOrder` already orders `expenses` after `binds` — confirm with a test rather than assuming.
3. `addExpense` in the sync client, mirroring `L-addMember`: local write at version 1, queue, flush.
4. `L-hub`: add-expense form (payer defaults to the assumed member) and an expenses list.
5. New flow `F-add-expense` with its test; extend `F-sync` coverage to a group holding expenses.
6. **Contract test against a local Supabase stack** — run the real `merge` / `fetch-entity` / `list-roster` under `supabase start` and assert the shapes the fake server in `src/flows/harness/` claims. This slice changes those shapes, which is exactly when the fake drifts (parked in 0004).

## Seams under test

| Seam | Behavior |
| --- | --- |
| `L-sortByFlushOrder` | An expense flushes after the member it names as payer |
| `addExpense` | Amount is integer cents; a negative or non-integer amount never reaches the queue |
| `F-add-expense` | Local first: the list shows it before any network call |
| Fake edge server vs real Edge Functions | Merge results and roster shapes agree for `expenses` |

## Acceptance

- Phone: open group → add expense (payer = You) → kill/reopen → the expense is still there.
- Two devices: an expense added on A appears on B without B being touched.
- Money never becomes a float; the amount round-trips exactly.
- `npm test` and `npm run typecheck` green; every flow still has a test.

## Out of scope

- Balances list and settle-up suggestions — they derive from this, and they are the next slice
- Editing or deleting an expense
- Unequal splits, shares, percentages
- Currency conversion; `currency_label` stays a label
- Attachments, or notes beyond one description line

## Parked this session

- Hub component split (still)
- Lobby ids out of Secure Store
- Symbol-level change attribution on the board
