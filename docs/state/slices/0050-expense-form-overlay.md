# Slice 0050 — expense form overlay on hub

**Tier** — polish · **Closed** — 2026-08-19 · **Tag** — `slice-0050`

## What shipped

FAB, settle prefill, and expense rows open `L-expenseForm` on the hub. **Close** abandons; save returns (member panel stays open after settle save). `/expense/new` and `/expense/[id]` remain URL wrappers.

## Report

### Headline
New and edit expense forms expand on the hub instead of pushing stack pages.

### Highlights
- **`L-expenseForm`** — extracted form with panel header, **Close**, **Delete** when editing.
- **`L-hub`** — `expensePane` state; FAB opens new; member settle keeps member underneath.

### Decisions

- D-104 — Expense form expands on the hub; expense routes stay URLs. Settle save closes form back to member panel.

### Flow delta

- **Changed** — `F-add-expense` · `F-edit-expense` · `F-delete-expense` · `F-settle-record`

### Shots

- Re-recorded affected expense flows.

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| Settle save | Member panel open | Form closes; member panel remains |

### Review

Self-review: expensePane mutual exclusion matches other overlays; URL wrappers unchanged.
