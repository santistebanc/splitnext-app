# Slice 0036 — activity event kinds

**Tier** — foundation-risk · **Closed** — 2026-08-18 · **Tag** — `slice-0036`

## What shipped

Edit, delete, kick, and rename jobs now append matching activity events. Feed, Activity page, and toast show per-kind lines (`edited`, `deleted`, `removed`, `renamed`).

## Report

### Headline
Edit expense → edit line; delete → delete line; kick → removed line; rename → renamed line — on hub, Activity page, and foreign toast.

### Highlights
- **`L-activityForExpenseEdited` / `L-activityForExpenseDeleted` / `L-activityForMemberKicked` / `L-activityForMemberRenamed`** — version-1 builders.
- **`L-formatActivityLine`** — per-kind lines; tombstoned targets still readable for delete/kick.
- **`L-updateExpense` / `L-deleteExpense` / `L-deleteMember` / `L-updateMember`** — queue activity after primary entity.
- **Worker** — merge accepts all five kinds; `member_id` column added to activities table.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Activity kinds | `expense_added` only | Also edit, delete, kick, rename |
| Feed copy | “X added …” only | Per-kind verbs via `L-activityLineText` |
| Jobs | add only | All five mutating jobs record when actor known |

### Surfaces touched

- **Client** — `L-activityForExpenseEdited` · `L-activityForExpenseDeleted` · `L-activityForMemberKicked` · `L-activityForMemberRenamed` · `L-formatActivityLine` · `L-activityLineText` · `L-updateExpense` · `L-deleteExpense` · `L-deleteMember` · `L-updateMember`
- **Server** — activities schema (`member_id`); merge validation widened
- **State** — `OVERVIEW.md`, `LOGIC.md`, `FLOWS.md`, `DECISIONS.md` (D-090), `PARKING.md`, this archive
- **Capture** — no new clip

### Logic delta

- **Added** — `L-activityForExpenseEdited` · `L-activityForExpenseDeleted` · `L-activityForMemberKicked` · `L-activityForMemberRenamed`
- **Changed** — `L-formatActivityLine` · `L-activityLineText` · `L-updateExpense` · `L-deleteExpense` · `L-deleteMember` · `L-updateMember` · worker merge

### Flow delta

- No FLOWS block change — existing `F-activity` clip still covers the add path; edit/delete/kick/rename use the same feed surfaces.

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `activityFor*` | no assumed member | Job runs; no activity queued. |
| `formatActivityLine` | tombstoned expense on add/edit | Returns null. |
| `formatActivityLine` | tombstoned expense on delete | Still shows description + amount. |
| `formatActivityLine` | tombstoned member on kick | Still shows removed name. |
| `patchExpense` / `patchMember` null | no change | No activity. |

### Review

- **Invariants** — Soft-delete, version merge, integer cents unchanged; activities still flush after primary entities.
- **Spec** — Four new kinds on existing jobs; no push/undo/join/leave.
- **Standards** — Pure builders + vitest; merge tests extended. No findings blocking merge.

### Shots

- No new flow clip — existing `F-activity` covers add; other kinds verified in tests.

### Diff pulse

Domain builders, four sync jobs, UI line renderer, worker schema + merge.

## Questions asked and answered

- **Queue order?** — Same as add: primary entity first, activity in flush queue after.

## What was parked during this slice

- Push, undo, join/leave/group-rename events, last-opened group, invite landing, legal

## Notes

Completes the core mutating-event kinds on the activity spine; join/leave/group rename still parked.
