# Slice 0034 — activity spine

**Tier** — foundation-risk · **Closed** — 2026-08-18 · **Tag** — `slice-0034`

## What shipped

Activity as a merge entity: `expense_added` on add when this device has an assumed member; hub **Recent activity** (last three) pinned above expense CTAs; **View all events** opens a dedicated Activity page; expense description styled inline.

## Report

### Headline
Add expense → hub shows recent activity → View all events → full Activity page.

### Highlights
- **`ActivityEntity`** + worker table, merge, roster pull.
- **`L-addExpense`** queues activity after expense (flush order).
- **`L-hub`** recent section + **`L-activity`** page; **`L-activityLineText`** styled description.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Activity | Not stored | Merge entity `activities`, flushed after expenses |
| Recording | — | `addExpense` appends `expense_added` (actor = assumed member) |
| Hub | Home + Settings only | Recent activity (last 3) above expense CTAs; **View all events** → Activity page |
| Sync | Roster: members, binds, expenses | Roster includes activities |

### Surfaces touched

- **Client** — `L-activityForExpenseAdded` · `L-formatActivityLine` · `L-addExpense` · `L-hub` · `L-activity` · `L-activityLineText`
- **Server** — `activities` table, merge, roster, fetch-entity
- **State** — `OVERVIEW.md`, `LOGIC.md`, `FLOWS.md`, `DECISIONS.md` (D-088), `PARKING.md`, this archive
- **Capture** — `F-activity`

### Logic delta

- **Added** — `L-activityForExpenseAdded` · `L-formatActivityLine` · `L-activity` · `L-activityLineText`
- **Changed** — `L-addExpense` (queue activity) · `L-hub` (recent section + navigate to activity page)

### Flow delta

- **Added** — `F-activity`
- **Changed** — `F-add-expense` (step 6–7: activity queued and flushed after expense)

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-activityForExpenseAdded` | missing actor or expense id | Returns null. |
| `L-addExpense` | no assumed member | Expense still saves; no activity row. |
| Merge | activity before expense in queue | Flush order prevents; server rejects if expense missing. |
| `L-activity` | empty | “No activity yet.” |
| `L-hub` | no events yet | Recent section hidden. |

### Review

- **Invariants** — Integer cents unchanged; soft-delete only; version conflicts; activities flushed after expenses; clients never touch D1/DO directly.
- **Spec** — Matches plan plus UX steering: page not drawer, recent at bottom, styled expense name. Toast/push/undo/other event kinds absent per out of scope.
- **Standards** — Pure domain + vitest; worker merge tests extended; capture flow `F-activity`. No findings requiring fix before merge.

### Shots

- Recorded `flows/F-activity.webm`

### Diff pulse

Activity entity end-to-end: domain, store, sync, worker, hub recent section, activity page, one flow clip.

## Questions asked and answered

- **Activity UI?** → Recent section on hub (not burger); full list as a page.
- **Layout?** → Add member under balances; recent activity above expense CTAs.
- **Expense name in line?** → Semibold ink via `ActivityLineText`.

## What was parked during this slice

- Toast, push, undo, other activity kinds, last-opened group, invite landing, legal

## Notes

First slice of the activity entity; toast/push/undo and richer event kinds build on this spine.
