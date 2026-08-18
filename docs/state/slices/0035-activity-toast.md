# Slice 0035 — activity toast

**Tier** — foundation-risk · **Closed** — 2026-08-18 · **Tag** — `slice-0035`

## What shipped

Hub toasts at the top when sync brings someone else's `expense_added` while the hub is mounted. Activity rows show relative timestamps. Wake messages trigger full roster sync.

## Report

### Headline
Stay on hub → another member adds a cost → top toast with relative time; feed rows show `5m ago`.

### Highlights
- **`L-activitiesFromOthers`** — pure diff since snapshot, excluding You.
- **`L-activityToast`** — top banner, auto-dismiss, tap → Activity page.
- **`L-relativeTime` / `L-activityRow`** — relative labels on hub, Activity page, and toast.
- **`L-wakeSub`** — wake tip runs `L-syncGroup` (not single-entity fetch).

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Awareness | Pull updates the feed silently | Top toast when sync brings someone else's activity |
| Timestamps | — | Relative labels on all activity rows |
| Wake handler | Fetched one entity per tip | Full roster sync per wake |

### Surfaces touched

- **Client** — `L-activitiesFromOthers` · `L-activityToast` · `L-activityRow` · `L-relativeTime` · `L-hub` · `L-activity` · `L-wakeSub`
- **Server** — none
- **State** — `OVERVIEW.md`, `LOGIC.md`, `FLOWS.md`, `DECISIONS.md` (D-089), `PARKING.md`, this archive
- **Capture** — no new clip (needs two contexts; manual demo)

### Logic delta

- **Added** — `L-activitiesFromOthers` · `L-activityToast` · `L-activityRow` · `L-relativeTime`
- **Changed** — `L-hub` (toast wiring) · `L-activity` (relative rows) · `L-wakeSub` (full sync on wake)

### Flow delta

- **Changed** — `F-activity` (steps 2–4: relative rows + toast on foreign sync)

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-activitiesFromOthers` | no assumed member | Empty; no toast. |
| `L-activitiesFromOthers` | actor is You | Excluded. |
| `L-activityToast` | two foreign events in one sync | Toast the newest only. |
| Hub | first open with history | Baseline after initial sync; no toast for old events. |
| Hub | activity before expense in store | Foreign id not absorbed until line formats. |
| Hub | user navigates away before dismiss | Toast unmounts cleanly. |

### Review

- **Invariants** — Soft-delete, version merge, integer cents unchanged; wake still tip-only from server.
- **Spec** — Toast only while hub mounted; not on lobby; no push/undo/new event kinds per out of scope.
- **Standards** — Pure diff + vitest; wake fix prevents expense/activity race. No findings blocking merge.

### Shots

- No new flow clip — `F-activity` toast path needs two browser profiles; re-record deferred.

### Diff pulse

Toast + relative time + wake sync fix: domain diff, hub snapshot logic, three UI components, wake handler.

## Questions asked and answered

- **Toast not showing?** → Fixed absorb race and wake single-fetch; moved toast to top.
- **Timestamps?** → Relative labels on all activity surfaces.

## What was parked during this slice

- Push, undo, other activity kinds, last-opened group, invite landing, legal

## Notes

Activity toast completes the first awareness slice on the 0034 spine; push still needs device tokens.
