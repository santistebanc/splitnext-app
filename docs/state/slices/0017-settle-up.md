# Slice 0017 — Settle-up suggestions

**Tier** — core-value · **Closed** — 2026-08-13 · **Tag** — `slice-0017`

## What shipped

The hub lists the fewest transfers that zero every live member's net — derived from balances, identical on every device, never stored. Rows do not move money.

## Report

### Headline
Balances already showed who is up or down; Settle up now says who should pay whom, in the fewest transfers.

### Highlights
- **`L-settle`** — `suggestSettlements` partitions zero-sum subgroups then pairs poorest with richest; member-id ties; leftover omitted.
- **`L-hub`** — Settle up under Balances, You marked, hidden when square, rows inert.
- **D-067** — derived, not stored; does not move money. Same family as D-026.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Hub | Nets only; the person invents who pays whom | Settle up list: `Name → Name` + amount, You marked |
| When square | No transfer plan | Section hidden |
| Algorithm | Unmodelled | Settle Up min-count, not Splitwise greedy |

### Surfaces touched

- **Client** — `src/domain/settle.ts`, `app/group/[id].tsx`
- **Capture** — `docs/scripts/capture-flows.mjs`, `capture-driver.mjs`
- **State** — `LOGIC.md`, `FLOWS.md`, `OVERVIEW.md`, this archive, `DECISIONS.md` (D-067), `PARKING.md`

### Decisions this slice

- D-067 — Settle-up is derived from balances, never stored; exact min-transfer-count; rows do not move money.

### Logic delta

- **Added** — `L-settle` (fewest transfers from the nets)
- **Changed** — `L-hub` (Settle up section)

### Flow delta

- **Added** — `F-settle` (see who should pay whom)
- **Changed** — `F-add-expense` (step 6: settle list refolds with balances)

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-settle` | all nets 0, or fewer than two non-zero | `[]` — hub hides the section |
| `L-settle` | `{+5, −5}` beside `{+6, −4, −2}` | three transfers, not greedy's four |
| `L-settle` | leftover +300 next to a +400/−400 pair | the pair settles; +300 is omitted, no invented person |
| `L-settle` | same nets, reversed array | identical list |
| `L-hub` | no expenses yet | no Settle up section (same as all-zero) |
| `L-hub` | this device is the debtor or the creditor | You (Name) on that side; the other name is plain |
| `L-hub` | member display name is empty | `(unnamed)`, or `You (unnamed)` — not `You ((unnamed))` |
| `L-settle` | more than 16 non-zero nets | poorest↔richest only; exact partition is capped so the hub cannot hitch |

### Review

- **Invariants** — no violations. Integer cents; derived not stored (D-026); rows inert. D-067 names the settle rule rather than leaving it implied by D-025.
- **Spec** — seams covered. Added tests for a single leftover and the >16 cap. `balancesOf` no longer swallows Settle up. Empty names render `You (unnamed)`. Accepted: `F-open` / `F-add-expense` re-recorded because the hub chrome changed; stills named `-settle.png`.
- **Standards** — `suggestSettlements` reads `Balance[]` and does not recompute nets. Dropped a duplicate `Open` alias. Accepted: You-label stays local on the hub; DP stays behind the one export.

### Shots

- `0017-settle.png` — three members after a 10.00 split; Cy and Bo pay You (Ana).
- `flows/F-settle.webm` — new. Re-recorded `flows/F-balances.webm`, `flows/F-add-expense.webm`, `flows/F-open.webm` (hub now carries the section).

### Diff pulse

`+444 / −12 · 16 files` — from `git diff --cached --stat` at close

## Questions asked and answered

- **Which algorithm?** → Settle Up's exact min-transfer-count (zero-sum subgroups, then poorest↔richest), not Splitwise greedy (D-067).
- **Whole group or You only?** → Whole group, You marked. Rows inert.

## What was parked during this slice

- Prefill a settlement expense from a row → PARKING (core value)
- Transaction tolerance (“ignore leftovers under $1”) → PARKING (polish)

## Notes

Beyond 16 non-zero nets the exact partition is skipped so a large roster cannot hitch the hub; friend groups stay under the cap.
