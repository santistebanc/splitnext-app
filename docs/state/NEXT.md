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
| Choosing who you are | One shot: the button vanished for good once this device bound (`L-deviceHasBind`) | Open until the group's first expense: every member offers it, and the choice can be moved (`L-bindingOpen`) |
| Server | Three tables | + `expenses`, deny-all RLS, same version rule |

## Plan

1. `expenses` migration; widen `L-efMerge` / `L-efFetch` / `L-efRoster` to carry the new entity type; deploy.
2. Expense entity in `src/types/group.ts`. `L-sortByFlushOrder` already orders `expenses` after `binds` — confirm with a test rather than assuming.
3. `addExpense` in the sync client, mirroring `L-addMember`: local write at version 1, queue, flush.
4. `L-hub`: add-expense form (payer defaults to the assumed member) and an expenses list.
5. Document the new flow as `F-add-expense` in `FLOWS.md`.
6. `L-bindingOpen` replaces `deviceHasActiveBind` as the gate on `L-bindMe` and on the hub's button: expenses close binding, not the bind itself. Re-binding moves the existing bind to the new member at the next version instead of creating a second live one.

## Seams under test

| Seam | Behavior |
| --- | --- |
| `L-sortByFlushOrder` | An expense flushes after the member it names as payer |
| `addExpense` | Amount is integer cents; a negative or non-integer amount never reaches the queue |
| `L-bindingOpen` | Open on an empty group and on one holding only tombstoned expenses; closed as soon as one live expense exists |

## Acceptance

- Phone: open group → add expense (payer = You) → kill/reopen → the expense is still there.
- Two devices: an expense added on A appears on B without B being touched.
- Money never becomes a float; the amount round-trips exactly.
- Before any expense: every member offers **This is me**, and tapping a second one moves the claim. After the first expense: no member offers it.
- `npm test` and `npm run typecheck` green.

## Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-hub` | group has no members yet | The list says "No members yet — add yourself first"; no button to offer. |
| `L-hub` | this device has not bound | Every member offers **This is me**; the expense form is hidden and the hint says to tap it first. |
| `L-hub` | bound, still no expenses | The claimed row reads You (Name) with no button; every other member still offers one, so the choice can be moved. |
| `L-hub` | first expense exists | No member offers the button, including unclaimed ones. |
| `L-bindMe` | tapped after an expense exists | Refuses with `binding_closed` and writes nothing — the UI has already hidden the button, so this is the rule, not the message. |
| `L-bindMe` | tapped on the member already claimed | Returns without queueing anything; no wasted version bump, no wake for a no-op. |
| `L-bindMe` | re-bound before any expense | The existing bind is re-pointed at the new member at version + 1; the server accepts the higher version. Verified through a full `L-pullRoster` round trip. |
| `L-bindMe` | member deleted between render and tap | Refuses with `member_missing`. |

## Out of scope

- Balances list and settle-up suggestions — they derive from this, and they are the next slice
- Editing or deleting an expense
- Any way to change who you are once an expense exists — deliberately closed for now; a later slice reopens it explicitly
- Unequal splits, shares, percentages
- Currency conversion; `currency_label` stays a label
- Attachments, or notes beyond one description line

## Parked this session

- **Flow tests and the fake edge server** — removed in 0005; the harness cost more than it paid while the shape of the app is still moving. Revisit when the surfaces settle; the board still reads coverage from test filenames if they come back
- Hub component split (still)
- Lobby ids out of Secure Store
- Symbol-level change attribution on the board
