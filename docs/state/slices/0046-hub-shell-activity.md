# Slice 0046 — headerless hub + activity expand

**Tier** — polish · **Closed** — 2026-08-19 · **Tag** — `slice-0046`

## What shipped

The hub has no stack header. Home and Settings sit on the canvas. **View all events** and the toast expand the full activity list on the hub; **Close** returns.

## Report

### Headline
Headerless hub; Recent activity expands in place instead of pushing a page.

### Highlights
- **`L-hubCorner`** — Home (lobby) and Settings overlay the hub, safe-area inset.
- **`L-activityFeed`** — full list + Undo; hub expand and `/activity` share it.
- **`L-hub`** — `headerShown: false`; `activityOpen` hides balances / FAB / all-expenses.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Hub chrome | Stack header: Home + Settings | No header bar; those controls on the canvas |
| Full activity | `router.push` `/group/[id]/activity` | Same hub; recent block expands |
| Close | Stack back | **Close** on the expanded list |

### Surfaces touched

- **Client** — `L-hub` · `L-hubCorner` · `L-activityFeed` · `L-activity` · `L-activityToast`
- **Capture** — `F-activity` · `F-undo`
- **State** — `OVERVIEW.md`, `LOGIC.md`, `FLOWS.md`, `DECISIONS.md` (D-100), `PARKING.md`, this archive

### Decisions this slice

- D-100 — Headerless hub; activity expands on the hub. Narrows D-084, D-088, D-089.

### Logic delta

- **Added** — `L-hubCorner` · `L-activityFeed`
- **Changed** — `L-hub` · `L-activity` · `L-activityToast` · `L-activityRow`

### Flow delta

- **Changed** — `F-activity` (step 3–4 expand on hub) · `F-undo` (Undo on expanded feed; Close not `goBack`)

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-hub` | no events yet | Recent hidden; corners still there |
| `L-hub` | activity open | FAB / all-expenses / balances hidden |
| `L-activity` route | opened by URL | Still the page (not the hub path) |
| `L-activityToast` | tap | Expands on hub |

### Review

- **Invariants** — D-088 / D-089 said the hub pushed `/activity`. D-100 records the narrowing. Money, merge, soft-delete, Worker door, and D-091 (Home → lobby) unchanged. Undo still on the feed (D-095).
- **Spec** — Matches NEXT.md: headerless corners, expand not push, Close returns, `/activity` kept. Other overlays, accordion, lobby-switcher stayed out. Receding is a hide/fade, not a shared layout animation.
- **Standards** — `HubCornerChrome` and `ActivityFeed` are the new modules; hub still owns `activityOpen`. Capture keeps `testID="activity-page"` on the expand.

### Shots

- Re-recorded `flows/F-activity.webm` · `flows/F-undo.webm`

## What was parked during this slice

- Lobby / settings / expense / all-expenses as overlays
- Member accordion
- Hub-as-switcher lobby
- Deleting `/group/[id]/activity`

## Notes

First slice of hub-as-shell. Invite `/j/{token}` stays a URL.
