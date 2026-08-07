# Slice 0007 — allocations + balances

**Tier** — core value (with foundation-risk in the merge shape)

## Goal

Close the hole in the ledger: an expense records *who owes*, not just who paid, and the hub shows each member's net position. Allocations ride **inside** the expense entity, so one version carries a split that always sums to its total — the invariant balances fold over.

## Before → After

| | Now | After |
| --- | --- | --- |
| Expense | `payer_member_id` + `amount_cents`; who owes is unmodelled | `allocations: [{member_id, amount_cents}]` on the same entity, summing to the total |
| Split | — | Equal across every live member at record time, largest-remainder rounding, identical on every device |
| Hub (`L-hub`) | Members list + expense list | Balances section above expenses: each member's net cents, most-negative first, You (Name) marked; each expense row says how many ways it split |
| Store open (`L-getGroupStore`) | Persisted timestamps left as whatever Legend revived | Runs `L-normalizeTimestamps` on open so a reopened multi-expense group cannot crash on `localeCompare` |
| Merge | Expense merges as a flat row | Same single-version merge; the split cannot half-apply |

## Plan

1. Migration — `allocations jsonb not null default '[]'` on `expenses`; add it to `EXPENSE_SELECT` and `expenseRow`.
2. `L-splitEqually` (`src/domain/split.ts`) — amount + member ids → allocations. Largest-remainder: base share to all, leftover cents handed out in sorted-id order so two devices computing the same split agree byte for byte.
3. `L-balances` (`src/domain/balances.ts`) — live members + live expenses → net cents per member (Σ paid − Σ owed), sorted most-negative first. An expense with no allocations credits its payer and debits nobody.
4. `L-addExpense` allocates across live members at record time and rejects a split that does not sum to the total.
5. `L-hub` — Balances section above the expense list; each expense row says how many ways it split.
6. `L-normalizeTimestamps` — undo Legend's Date revival on persist reload; `L-getGroupStore` runs it before anything reads the store.

## Seams under test

| Seam | Behavior |
| --- | --- |
| `L-splitEqually` — `src/domain/split.ts` | Every cent is allocated, no member is short by more than one cent, order is deterministic |
| `L-balances` — `src/domain/balances.ts` | Nets sum to zero; deleted members/expenses excluded; allocation-less expenses degrade safely |

## Acceptance

- Three members, expense of `1000` cents → allocations `334 / 333 / 333`; every device computes the same assignment.
- Hub shows balances that sum to zero, most-negative first, with the assumed member labelled.
- The expense round-trips through `merge` → `list-roster` with its allocations intact.
- Full suite + typecheck green; `npm run web` drives create → member → bind → expense → balances.

## Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| Balances | expense recorded before this slice (empty `allocations`) | Payer is credited, nobody is debited, so the visible list does not net to zero. Honest over invented: re-splitting it now would attribute a debt the expense never recorded. |
| Balances | allocation names a member this device has not pulled yet | The share is skipped rather than shown against a blank row; the roster pull that follows corrects it. |
| Balances | member soft-deleted after being allocated | Row disappears, their debt leaves the visible total, group no longer nets to zero. No UI reaches this today — member delete is parked — but the fold must not crash on it. |
| `splitEqually` | duplicate ids in the roster | Deduped before splitting, so a doubled member cannot be charged twice. |
| `splitEqually` | amount smaller than the member count (e.g. 2c across 5) | The first two by id owe a cent each, the rest owe nothing. Every cent is still allocated. |
| `L-addExpense` | group has exactly one member | That member pays and owes the whole amount; net zero, which is correct. |
| Hub | no expenses yet | Shows "everyone is square" rather than a list of zeros, so an empty group reads as empty rather than broken. |
| Hub | reopened with two or more expenses | **Crashed the whole screen** until fixed. Legend's parser revives any exact ISO-8601 string into a `Date`, so `updated_at` came back a different type than it went in and `localeCompare` blew up. Latent since the persist work in 0006 and invisible with one expense, because a one-item sort never calls the comparator. Fixed at store open by `L-normalizeTimestamps`. |
| `L-getGroupStore` | store persisted before this slice | Normalized on open, so a device carrying Dates from an older build is repaired rather than left to crash. |
| `L-edgeFetch` | wake naming an expense, stale `fetch-entity` deployed | 400 `unsupported` surfaced as `fetch_failed` on the hub and the wake was dropped; the next roster pull still caught up. Fixed by deploying the function, not by code. |

## Out of scope

- Participant picker, uneven / share-based splits, expense editing (parked: **Expense editor + invariants**)
- Settle-up suggestions
- Member rename / soft-delete UI
- Backfilling allocations onto the 0005 demo expenses

## Parked this session

- **Deploy drift between local and remote** — the remote was missing the whole `expenses` table and a stale `fetch-entity`, three slices after 0005 said both shipped. Nothing checks that what is committed is what is deployed — foundation-risk
