# Slice 0055 — wake orchestrator tests

**Tier** — foundation-risk · **Closed** — 2026-08-19 · **Tag** — `slice-0055`

## What shipped

`npm test` now drives `startWakeSubscription` against the same local Worker as the HTTP contract: token gate, wake-tip catch-up, reconnect catch-up after drop, and leave stop. A closed socket no longer blocks reconnect (`hasLiveWakeSocket`).

## Report

### Headline
The wake orchestrator is proven in CI, not just the raw `/wake/` wire.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Wake coverage | `wakePolicy` + `/wake/` wire in `edge.test.ts` | `wake.test.ts` drives `L-wakeSub` end-to-end |
| Reconnect | Assumed from policy + code review | Proven: drop → timer → catch-up |
| Zombie socket | Map presence could block reconnect | Live `readyState === OPEN` check |

### Surfaces touched

- **Client** — `L-wakeSub` (`hasLiveWakeSocket`; test seams `resetWakeStateForTests`, `getWakeSocketForTests`); `src/sync/wake.test.ts`
- **State** — `NEXT.md`, `PARKING.md`, this archive

### Logic delta

- **Changed** — `L-wakeSub` (reconnect uses live socket check, not map presence)

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-wakeSub` | no access token | Returns without opening a socket |
| `L-wakeSub` | wake tip while subscribed | catchUp runs once |
| `L-wakeSub` | socket error then reconnect | catchUp runs on second OPEN |
| `L-wakeSub` | stopWakeSubscription after open | Socket cleared; retry timer does not run catchUp |

### Review

- **Invariants** — no product behaviour change beyond reconnect when a dead socket remained in the map; tests mock token/device only.
- **Spec** — five orchestrator tests; CI flake fixed by triggering `onerror` instead of close timing race.
- **Standards** — test seams follow `resetAutoOpenLastGroupForTests` pattern.

### Shots

No capture: no UI surface changed.

### Diff pulse

From PR #59 merge on `main`.
