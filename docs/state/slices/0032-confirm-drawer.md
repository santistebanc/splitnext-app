# Slice 0032 — confirm drawer

**Tier** — polish · **Closed** — 2026-08-18 · **Tag** — `slice-0032`

## What shipped

Destructive confirmations (Leave group, Delete expense) moved from inline blocks into a shared bottom confirm drawer — same `InFrameOverlay` chrome as payer and currency pickers.

## Report

### Headline
Leave and Delete confirm in a bottom drawer, not inline on the form.

### Highlights
- **`L-confirmDrawer`** — reusable confirm sheet: backdrop tap cancels, Cancel + confirm actions, destructive styling.
- **`L-settings`** — Leave opens the drawer; trigger button stays visible.
- **`L-expenseNew`** — Delete opens the drawer; same testIDs for capture.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Leave confirm | Inline block replaced the Leave button | Bottom drawer over Settings |
| Delete confirm | Inline block in the edit form scroll | Bottom drawer over the form |
| Pattern | Duplicated inline styles on two screens | One `ConfirmDrawer` component |

### Surfaces touched

- **Client** — `L-confirmDrawer` · `L-settings` · `L-expenseNew`
- **Server** — none
- **State** — `OVERVIEW.md`, `LOGIC.md`, `FLOWS.md`, this archive, `DECISIONS.md` (D-086)
- **Capture** — `F-leave`, `F-delete-expense` (re-recorded)

### Logic delta

- **Added** — `L-confirmDrawer`
- **Changed** — `L-settings`, `L-expenseNew` (confirm drawer instead of inline)

### Flow delta

- **Changed** — `F-leave`, `F-delete-expense` (confirm step is a drawer; behaviour unchanged)

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-confirmDrawer` | backdrop tap / Cancel | Closes without action. |
| `L-confirmDrawer` | `busy` | Backdrop, Cancel, and confirm disabled. |
| `L-settings` | Leave confirmed | Same as before: `L-leaveGroup`, lobby. |
| `L-expenseNew` | Delete confirmed | Same as before: tombstone, navigate back. |

### Review

- **Invariants** — No domain or sync changes; money, version, soft-delete rules untouched.
- **Spec** — Drawer only; no new destructive actions; capture testIDs preserved.
- **Standards** — Extracted duplicated inline confirm into one module; matches `PayerSelect` / `CurrencySelect` overlay pattern. No speculative generality — two call sites, one component.

### Shots

- Re-recorded `flows/F-leave.webm`, `flows/F-delete-expense.webm`

### Diff pulse

```
 src/ui/ConfirmDrawer.tsx          | new
 app/group/[id]/settings.tsx       | inline confirm → drawer
 app/group/[id]/expense/new.tsx    | inline confirm → drawer
 docs/state/FLOWS.md               | drawer wording
 docs/state/LOGIC.md               | L-confirmDrawer + screen copy
 docs/state/shots/flows/*.webm     | re-recorded
```

## Questions asked and answered

- **Close as slice 0032?** → Yes.

## What was parked during this slice

- Nothing new; kick, activity, last-opened, invite landing, legal unchanged.

## Notes

UX polish requested after 0031; no behaviour change beyond presentation.
