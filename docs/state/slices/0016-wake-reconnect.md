# Slice 0016 — Wake socket retries itself

**Tier** — foundation-risk · **Closed** — 2026-08-13 · **Tag** — `slice-0016`

## What shipped

If the wake socket drops while the hub stays open, this device reconnects on its own (backoff) and then runs the same catch-up as open. Status words are `OPEN` / `ERROR` / `CLOSED`.

## Report

### Headline
Native WebSocket does not rejoin the way Realtime did; the client now retries, so D-054 is true on this host.

### Highlights
- **`L-wakeSub`** — drop of the *current* socket schedules a retry; close of a replaced socket is ignored; connect timeout is `ERROR`.
- **`L-wakeCatchUp`** — `nextReconnectDelayMs` is 1s × 2^n capped at 30s; catch-up on `OPEN` after `ERROR` / `CLOSED`.
- **D-066** — retargets D-061's mapped names. D-054 still holds (no cursor).

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Drop while hub open | Status recorded; nobody retries | Client retries with backoff, then `syncGroup` |
| Status words | `SUBSCRIBED` / `CHANNEL_ERROR` / unused `TIMED_OUT` | `OPEN` / `ERROR` / `CLOSED` |
| Connect hang | Promise gives up; dead socket kept | `ERROR` and retried |

### Logic delta

- **Changed** — `L-wakeCatchUp` (`nextReconnectDelayMs`; statuses `OPEN` / `ERROR` / `CLOSED`) · `L-wakeSub` (retries the current socket)

### Flow delta

- **Changed** — `F-wake-reconnect` (steps 1–2: client retries; `OPEN` after a drop)

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-wakeSub` | `onerror` then `onclose` | One retry. Second event is not the current socket. |
| `L-wakeSub` | Close of a socket we replaced | Ignored; the new connect is already in flight. |
| `L-wakeSub` | Connect never opens | After 8s: `ERROR`, retry. |
| `L-wakeSub` | `openGroup` while a retry is waiting | Timer cancelled; connect starts now. |
| `L-wakeCatchUp` | First `OPEN` (`prev` null) | No catch-up. `L-openGroup` already ran `L-syncGroup`. |
| `L-wakeSub` | Constructor / connect throws | Retry scheduled; not an unhandled rejection. |
| `L-wakeSub` | No access token | No socket, no retry. |
| `F-wake-reconnect` | Retries keep failing | Delay caps at 30s; never gives up this session. Open/foreground still catch up. |

### Review

- **Invariants** — cents, version merge, soft-delete, client talks only to the Worker. Wake still tip-only; catch-up is still `syncGroup` (D-054). D-066 says so rather than quietly reversing D-061.
- **Spec** — policy tests pin statuses, delay cap, and no `TIMED_OUT`. Wiring (identity check, timer cancel) is reviewed in edge paths, not a second fake WebSocket suite.
- **Standards** — backoff lives on `wakePolicy` next to the other wake rules. Accepted: no hub chrome for "reconnecting" (parked).

### Shots

No capture: `F-wake-reconnect` still cannot force a socket drop from the web driver.

### Surfaces touched

- **Client** — `src/sync/wake.ts`, `src/sync/wakePolicy.ts`
- **State** — `LOGIC.md`, `FLOWS.md`, `OVERVIEW.md`, this archive, `DECISIONS.md` (D-066), `PARKING.md`

### Decisions this slice

- D-066 — Wake statuses are `OPEN` / `ERROR` / `CLOSED`; current socket retries with backoff. Retargets D-061's mapped names. D-054 still holds.

### Diff pulse

`+166 / −44 · 10 files` plus this archive — from `git diff main --stat` at close.

## Questions asked and answered

- **Cursor, or retry then `syncGroup`?** → Retry then existing catch-up. No new endpoint.

## What was parked during this slice

- Reconnecting indicator on the hub → PARKING (polish)
- Stop the socket when the hub unmounts → PARKING (session-lived sockets already)

## Notes

Realtime used to rejoin for us. This slice is that rejoin, on the client.
