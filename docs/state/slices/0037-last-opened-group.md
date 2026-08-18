# Slice 0037 — last opened group on launch

**Tier** — core value · **Closed** — 2026-08-18 · **Tag** — `slice-0037`

## What shipped

Cold start opens the last hub when that group is still on the lobby. Home still returns to the list.

## Report

### Headline
Open a group → relaunch app → lands on that hub; tap Home → lobby list as before.

### Highlights
- **`L-lastOpened`** — pure pick when id ∈ lobby ids.
- **`L-lastOpenedSession`** — once-per-session auto-open gate.
- **`L-openGroup`** — persists last opened on every hub open.
- **`L-lobbyIds`** — stores/clears `last_opened_group_id`; leave removes matching id.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Cold start | Always lobby | Auto-replace to last hub when still known |
| Home from hub | Lobby | Lobby (unchanged) |

### Surfaces touched

- **Client** — `L-lastOpened` · `L-lastOpenedSession` · `L-openGroup` · `L-lobby` · `L-lobbyIds`
- **Server** — none
- **State** — `OVERVIEW.md`, `LOGIC.md`, `DECISIONS.md` (D-091), `PARKING.md`, this archive
- **Capture** — no new clip

### Logic delta

- **Added** — `L-lastOpened` · `L-lastOpenedSession`
- **Changed** — `L-openGroup` · `L-lobby` · `L-lobbyIds`

### Flow delta

- No FLOWS block change (behaviour extends F-open / lobby mount).

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| Last id not in lobby | left group | Stay on lobby. |
| Empty lobby | no groups | Lobby as today. |
| Second lobby visit same session | user tapped Home | No auto-replace. |
| Leave group | last matched | `removeLobbyGroupId` clears last opened. |

### Review

- **Invariants** — No server change; tokens/lobby list unchanged apart from last-opened secret.
- **Spec** — Once per session; Home not overridden.
- **Standards** — Pure resolver + vitest. No findings blocking merge.

### Shots

- No new flow clip.

### Diff pulse

Two pure modules, tokens helpers, lobby redirect, openGroup persist.

## What was parked during this slice

- Push notifications, undo, invite landing, legal, pending badge

## Notes

Completes D-084 last-opened item; push is next in the queue.
