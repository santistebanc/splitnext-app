# Slice 0055 — wake orchestrator tests

**Tier** — foundation-risk

## Goal

`startWakeSubscription` is covered against the local Worker: token lookup, wake-tip catch-up, reconnect catch-up, and leave stop — not just the raw `/wake/` wire.

## Before → After

| | Now | After |
| --- | --- | --- |
| Wake coverage | `wakePolicy` pure tests + `/wake/` wire contract in `edge.test.ts` | `wake.test.ts` drives `L-wakeSub` orchestration |
| Catch-up trigger | Assumed by code review | Proven: wake tip and reconnect-after-drop both call catch-up |
| Leave | `stopWakeSubscription` untested at orchestrator level | Proven: stop clears socket and skips retry catch-up |

## Plan

1. Add test seams on `wake.ts`: `resetWakeStateForTests`, `getWakeSocketForTests`.
2. **`wake.test.ts`** — local Worker harness; mock `getAccessToken` / `getOrCreateDeviceUserId`.
3. Tests: no token → no socket; open succeeds; merge wake tip → catchUp; drop + timer → reconnect catchUp; stop → no retry.
4. Groom `PARKING.md` entry.

## Seams under test

| Seam | Behavior |
| --- | --- |
| `L-wakeSub` | Opens `/wake/` with stored token; wake tip runs catch-up; reconnect after drop runs catch-up; stop closes without retry |

## Acceptance

- `npm run check` passes.
- New tests fail if wake tip or reconnect catch-up wiring is removed.

## Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| | | *(filled during build)* |

## Out of scope

- Full `syncGroup` / inbound fetch integration
- `/wake/` on `FUNCTIONS`
- Capture clip for wake reconnect

## Parked this session

- Browser flow taxonomy expansion — testing
