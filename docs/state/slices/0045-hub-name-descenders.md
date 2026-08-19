# Slice 0045 — hub name descenders

**Tier** — polish · **Closed** — 2026-08-19 · **Tag** — `slice-0045`

## What shipped

Hub roster and balance rows use a 1.4 line box so single-line names like Diego show full descenders.

## Report

### Headline
Hub names no longer clip `g`/`y` on one line.

### Highlights
- **`L-hub`** — `TYPE_LINE` 1.25 → 1.4; `typeSizeFor` still divides by it so many-member groups shrink type instead of scrolling.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Hub name/balance row | 1.25× font clips descenders at `numberOfLines={1}` | 1.4 — descenders visible |
| Type scaling | Fits N rows | Same algorithm; slightly smaller type when many rows |

### Surfaces touched

- **Client** — `L-hub`
- **State** — `OVERVIEW.md`, `LOGIC.md`, `PARKING.md`, this archive

### Decisions this slice

- None (visual fix on an existing surface).

### Logic delta

- **Changed** — `L-hub`

### Flow delta

- No FLOWS.md change (same taps; taller line boxes only).

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-hub` | long name | Still ellipsizes at one line |
| `L-hub` | many members | `typeSizeFor` shrinks font to fit taller line boxes |

### Review

- **Invariants** — UI-only line-height; money, merge, soft-delete, Worker door, and D-099 (no pending on hub) unchanged.
- **Spec** — Matches NEXT.md: one constant; group title, hub-as-shell, invite resend, store listings, and pending-on-hub stayed out. No seam listed, so no new tests.
- **Standards** — Thin: one named constant already used by `typeSizeFor` and the row `lineHeight`.

### Shots

- No new capture clip (typography of existing hub stills; flows did not change).

## What was parked during this slice

- Group title line box
- Hub-as-shell
- Invite status / resend
- Store listings
- Pending on hub rows

## Notes

Parking originally said “hub title”; the clip was member names (`Diego`), which is what `TYPE_LINE` sizes.
