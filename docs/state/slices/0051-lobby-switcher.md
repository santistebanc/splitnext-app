# Slice 0051 — lobby-as-switcher on hub

**Tier** — polish · **Closed** — 2026-08-19 · **Tag** — `slice-0051`

## What shipped

Home on the hub expands the group switcher (`L-lobbyPanel`) with **Close**. Picking a group switches the hub in place. `/` remains the standalone lobby (no Close). Completes hub-as-shell.

## Report

### Headline
Home opens the lobby as an overlay switcher instead of navigating away from the hub.

### Highlights
- **`L-lobbyPanel`** — extracted from `L-lobby`; closable on hub, not at `/`.
- **`L-hubCorner`** — Home expands lobby overlay.

### Decisions

- D-105 — Home on the hub expands `L-lobbyPanel`; `/` stays the unclosable lobby.

### Parking delivered

- Hub-as-shell — complete after this slice.

### Shots

- Re-recorded `F-open` if needed.

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `/` lobby | No hub | No Close on `L-lobbyPanel` |

### Review

Self-review: `replace` on group pick; last-opened auto-open unchanged at `/`.
