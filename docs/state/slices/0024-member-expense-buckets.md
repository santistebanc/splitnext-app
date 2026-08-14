# Slice 0024 — member expense buckets

**Tier** — breadth · **Closed** — 2026-08-14 · **Tag** — `slice-0024`

## What shipped

Opening a member shows what they paid for and what they owe for — one line per expense — then net, then settle. The lines add up to the net. Lines are not tappable.

## Report

### Headline
A member's screen is their ledger, then their net, then how they would settle.

### Highlights
- **Two buckets** — You paid for / You owe for (or that person's name); empty is **None**.
- **One line per expense** — N-way dinner is `Dinner · Alex + Jordan`, amount = that person's net on that expense (D-074).
- **Identity** — summing the lines equals `L-balances` net, including settlements.
- **Not tappable** — editor stays parked.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| `L-member` | Net, then outgoing settle | Paid-for, owe-for, net, settle |
| Empty bucket | (no section) | **None** |
| N-way expense | (hidden) | One line; counterparts joined with ` + ` |
| Settlement | Only in All expenses / nets | Also a bucket line |

### Surfaces touched

- **Client** — `L-member`; `L-memberBuckets`
- **Server** — none
- **State** — `OVERVIEW.md`, `LOGIC.md`, `FLOWS.md`, this archive, `DECISIONS.md` (D-074), `PARKING.md`
- **Capture** — `paidForOf` / `owesForOf`; `F-settle` / `F-settle-record` re-recorded

### Decisions this slice

- D-074 — One line per expense; amount is that member's net on that expense; lines sum to their balance. Paid-for names the other live allocated members; owe-for names the payer.

### Logic delta

- **Added** — `L-memberBuckets`
- **Changed** — `L-member` (buckets above net)

### Flow delta

- **Changed** — `F-settle` (step 3 buckets) · `F-settle-record` (step 5 Settlement in a bucket)

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-member` | Debtor after Taxi split three ways | Paid-for **None**; owe-for `Taxi · You (Ana)` −3.34 EUR; net matches; settle button present. |
| `L-memberBuckets` | Member not live / missing | Empty buckets (unit). |
| `L-memberBuckets` | Paid only for self | No paid-for line (unit). |
| `L-member` | Bucket line | A `View`, not a button. |
| `F-settle-record` | After save | Settlement appears in that member's paid-for; listed on `L-expenses`. |

### Review

- **Invariants** — D-074 said counterpart names were “the other live allocated members” for both buckets; owe-for names the payer (as NEXT and the prototype do). Tightened D-074 to distinguish paid-for vs owe-for. Integer cents, soft-delete, D-067 / D-069 / D-073 unchanged.
- **Spec** — Acceptance asked for a still of a member with both buckets filled; capture's spent fixture has one expense, so `0024-member.png` is the debtor (paid-for **None**). Accepted: both directions are unit-tested; a both-filled still needs a second expense. Extra hub / settle-prefill stills kept. Out of scope kept.
- **Standards** — Folded buckets into Settlement in OVERVIEW; fixed with a Member buckets data-model row, Last updated 0024, and `paidForOf` / `owesForOf` on the capture seam list. Renamed `shown` → `subjectName`. Accepted: signed-amount colour cascade copied onto bucket lines (same as hub / net).

### Shots

- `0024-hub.png` — balance-list hub after a spent group
- `0024-member.png` — member screen with buckets, net, settle (debtor)
- `0024-settle-prefill.png` — new-expense form opened from a settle button
- Re-recorded `flows/F-settle.webm` · `F-settle-record.webm`

### Diff pulse

`+617 / −22 · 16 files` — from `git diff --cached --stat` at close

## Questions asked and answered

- **One line per expense, or one per other person?** → One line per expense (D-074).
- **Build it?** → Yes.
- **Close it?** → Yes.

## What was parked during this slice

- Tap a bucket line to edit → PARKING (expense editor)
- Leave / kick on member detail → PARKING

## Notes

Capture used `--url http://127.0.0.1:8082` because 8081 was already taken. A member with both buckets filled is not in the spent fixture.
