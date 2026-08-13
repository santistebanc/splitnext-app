# Slice 0011 — missed-wake reconnect

**Tier** — foundation-risk · **Closed** — 2026-08-12 · **Tag** — `slice-0011`

## What shipped

A Realtime socket that dies while the hub stays open no longer means missed peer changes until the next foreground. When that group's channel returns to `SUBSCRIBED` after a drop, it runs the same `syncGroup` as open. No new endpoint, no cursor.

## Report

### Headline
A dropped Realtime socket, while the hub stays up, now catches up the same way open does — that group only, and not on the first subscribe.

### Highlights
- **`L-wakeCatchUp`** — `shouldCatchUpOnStatus`: catch up only when `SUBSCRIBED` follows `CHANNEL_ERROR`, `TIMED_OUT`, or `CLOSED`. First `SUBSCRIBED` does not.
- **`L-wakeSub`** — watches channel status; `onReconnect` is bound to `L-syncGroup` by `L-openGroup` / `L-createGroup` so the two modules do not import each other.
- **`F-wake-reconnect`** — on the map, unrecorded: needs a dropped socket and a second device, same blocker as `F-wake`.
- Server protocol unchanged — wake-only broadcast, no wake log.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| `L-wakeSub` | Fire-and-forget `subscribe()`; a dead socket is silent until open/foreground | Watches channel status; `SUBSCRIBED` after a drop runs `L-syncGroup` for that group |
| Missed wake, app still up | Lost until the next `L-openGroup` / `L-foreground` | Caught on reconnect via the existing roster pull |
| Server protocol | Wake-only broadcast | Unchanged — no cursor, no new endpoint |

### Logic delta

- **Added** — `L-wakeCatchUp` (`shouldCatchUpOnStatus`)
- **Changed** — `L-wakeSub` (status callback; reconnect runs `L-syncGroup`) · `L-openGroup` · `L-createGroup` (bind `onReconnect`)

### Flow delta

- **Added** — `F-wake-reconnect` (unrecorded — dropped socket plus a second device)
- **Changed** — none. `F-wake` still needs a second device; not re-recorded.

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-wakeCatchUp` | First `SUBSCRIBED` (`prev` null) | No catch-up. `L-openGroup` already ran `L-syncGroup`. Covered by test. |
| `L-wakeCatchUp` | `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED` then `SUBSCRIBED` | Catch-up. Covered by test. |
| `L-wakeCatchUp` | `SUBSCRIBED` then `SUBSCRIBED` | No catch-up — a status blip is not a drop. Covered by test. |
| `L-wakeSub` | `onReconnect` throws | Swallowed in the status callback so the channel stays subscribed. `L-syncGroup` records `lastError` itself when the catch-up fails. |
| `L-syncGroup` | Reconnect catch-up overlaps an in-flight open | `L-runExclusive` serialises them on that group. |
| `F-wake-reconnect` | Channel drops and never returns to `SUBSCRIBED` | Catch-up does not run. The next `L-openGroup` / `L-foreground` still pulls the roster — the hole this slice closes is only the "app stayed up" case. |
| `L-wakeSub` | One group's channel drops | Only that group runs `L-syncGroup`. Other lobby groups wait for their own channel or for `L-foreground`. |
| `L-wakeSub` | No access token | Returns without subscribing. Unchanged. |

### Review

- **Invariants** — no AGENTS.md invariant broken. D-009's trigger list (open + foreground) was incomplete once reconnect also runs `syncGroup`; appended D-054 rather than quietly reversing D-009. Full missed-wake protocol (cursor) stays parked.
- **Spec** — clean. Seam tests cover every acceptance transition; nothing from Out of scope landed.
- **Standards** — no hard violations. Accepted: three parallel maps in `wake.ts` left as incremental on the pre-existing `channels` map. Fixed: `onReconnect` is required (`() => Promise<void>`), so a 1-arg call cannot silently skip catch-up.

### Shots

- `0011-latest-slice.png` — still of the old Latest slice tab, taken before D-055 moved that view off the published board and onto a per-PR page.

Captured with `node docs/scripts/capture-board.mjs --slice 0011 --only latest-slice`. No app stills — no new screen. `F-wake-reconnect` is named in `capture-flows.mjs` as unrecorded rather than silently absent.

### Surfaces touched

- **Client** — `src/sync/wakePolicy.ts` (new), `src/sync/wake.ts`, `src/sync/groupSync.ts`
- **Server** — none
- **State** — `LOGIC.md` (+L-wakeCatchUp), `FLOWS.md` (+F-wake-reconnect), `OVERVIEW.md`, this archive, `DECISIONS.md` (D-054)

### Decisions this slice

- D-054 — On Realtime `SUBSCRIBED` after a drop, run the same `syncGroup` as open for that group; no cursor
- D-055 — Current slice is a per-PR slicer page, not a tab on the published board

### Diff pulse

`+172 / −11 · 11 files` — from `git diff --cached --stat` at close

## Questions asked and answered

- **Cursor or existing catch-up on reconnect?** → Reuse `syncGroup` on channel reconnect. No new endpoint (D-054).
- **When does catch-up fire?** → `SUBSCRIBED` after `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED`, that group only. Not on the first subscribe.

## What was parked during this slice

- Server-side cursor / wake log → PARKING (foundation-risk)
- Reconnecting indicator on the hub → PARKING (polish)

## Notes

- Tag `slice-0011` lands on `main` after the squash merge, not on the branch tip.
- Phoenix rejoins the same channel after a socket drop and re-fires `SUBSCRIBED` on the existing callback; this slice does not tear down and recreate the channel. If `SUBSCRIBED` never returns, open/foreground still catch up.
