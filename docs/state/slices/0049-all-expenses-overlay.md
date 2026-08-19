# Slice 0049 — all-expenses overlay on hub

**Tier** — polish · **Closed** — 2026-08-19 · **Tag** — `slice-0049`

## What shipped

**View all expenses** expands the expense list on the hub. **Close** returns. `/group/[id]/expenses` remains a URL wrapper.

## Report

### Headline
All expenses expands on the hub instead of pushing a stack page.

### Highlights
- **`L-expensesPanel`** — list with **Close** (`testID="expenses-close"`).
- **`L-hub`** — `expensesOpen` in `paneOpen`; mutually exclusive with other overlays.

### Decisions

- D-103 — All-expenses expands on the hub; `/expenses` stays a URL.

### Flow delta

- **Changed** — `F-edit-expense` · `F-delete-expense` (overlay + `expenses-close`).

### Shots

- Re-recorded `F-edit-expense` · `F-delete-expense`.

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| Expense row | Hub overlay open | Still pushes `/expense/{id}` until slice 0050 |

### Review

Self-review: mutual exclusion matches other hub overlays; URL wrapper unchanged.
