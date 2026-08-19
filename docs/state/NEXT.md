# Slice 0056 — Undo on hub recent list

**Tier** — foundation-risk

## Goal

After adding, deleting, or kicking from this device, the actor can tap **Undo** on that line in the hub **Recent activity** section — same behaviour as the expanded Activity feed, without opening **View all events**.

## Before → After

| | Now | After |
| --- | --- | --- |
| Hub recent rows | Show the line and relative time only | Show **Undo** when `L-formatActivityLine` says `canUndo` |
| Undo path | Expanded `L-activityFeed` on `L-hub` only | Hub recent section and expanded feed both call `L-undoActivity` |
| `F-undo` capture | Opens **View all events**, taps Undo there | Taps Undo on the hub recent row |

## Plan

1. Pass `onUndo` from `L-hub` into `L-activityRow` for each recent line — `(activityId) => undoActivity(groupId, activityId)`.
2. Update `F-undo` in `FLOWS.md` and `capture-flows.mjs` to assert Undo on hub recent.
3. Groom `L-hub` copy in `LOGIC.md` / `OVERVIEW.md` at close.

## Seams under test

| Seam | Behavior |
| --- | --- |
| `L-activityRow` | **Undo** renders when `canUndo` and `onUndo` is passed (already tested via domain; hub wiring is UI-only) |
| `L-planUndo` | unchanged — eligibility unchanged |
| `L-undoActivity` | unchanged — same job from hub recent |

## Acceptance

- Add an expense from this device → hub **Recent activity** shows **Undo** on that line → tap → expense gone, line gone.
- `npm run check` green.
- `F-undo` capture asserts Undo on hub recent without opening the full feed.

## Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-hub` | foreign line in recent | No Undo control |
| `L-hub` | stale add (edited after) | No Undo control |
| `L-planUndo` | activity already tombstoned | Tap is a no-op (control hidden once line drops) |

## Out of scope

- Undo of edit / rename — parked
- Undo on activity toast — parked (toast is read-only today)

## Parked this session

- Undo of edit / rename — foundation-risk · activity spine
- Close-ritual archive grooming for 0052–0054 — breadth
