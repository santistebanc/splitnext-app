# Slice 0056 — Undo on hub recent list

**Tier** — foundation-risk · **Closed** — 2026-08-20 · **Tag** — `slice-0056`

## What shipped

Hub **Recent activity** rows show **Undo** when this device can undo that line — same `L-undoActivity` path as the expanded Activity feed, without opening **View all events**.

## Report

### Headline
Undo a mistaken add/delete/kick from the hub recent list.

### Highlights
- `L-hub` passes `onUndo` into each recent `L-activityRow`.
- `F-undo` capture asserts Undo on hub recent (seed `spent` so the section stays visible).
- D-107 narrows D-095 / D-100: hub-recent Undo is no longer parked.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Hub recent rows | Line + relative time only | **Undo** when `canUndo` |
| Undo entry | Expanded feed only | Recent section and expanded feed |
| `F-undo` | Opens **View all events** | Taps Undo on hub recent |

### Surfaces touched

- **Client** — `L-hub` recent rows → `L-undoActivity`
- **Capture** — `F-undo` in `capture-flows.mjs`; `flows/F-undo.webm`
- **State** — `OVERVIEW.md`, `LOGIC.md`, `FLOWS.md`, `DECISIONS.md` (D-107), `PARKING.md`, this archive

### Decisions this slice

- D-107 — Undo on hub **Recent activity**; edit/rename/toast undo stay parked

### Logic delta

- **Changed** — `L-hub` (recent rows call `L-undoActivity`)

### Flow delta

- **Changed** — `F-undo` (trigger and step 2: Undo on hub recent)

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-hub` | foreign line in recent | No Undo control |
| `L-hub` | stale add (edited after) | No Undo control |
| `L-planUndo` | activity already tombstoned | Tap is a no-op (control hidden once line drops) |

### Review

- **Invariants** — no money/merge/soft-delete/Worker-door changes; reuses `L-undoActivity`. Deliberately narrows D-095 and D-100 via D-107.
- **Spec** — Matches NEXT: `onUndo` on recent rows; `F-undo` + clip on hub recent; edit/rename and toast undo untouched. LOGIC/OVERVIEW groomed at close (plan step 3).
- **Standards** — one-line UI wire; no new seam; domain eligibility unchanged.

### Shots

- Re-recorded `flows/F-undo.webm`

### Diff pulse

`+65 / −16 · 6 files` — product commit before close docs; close adds archive + state groom.
