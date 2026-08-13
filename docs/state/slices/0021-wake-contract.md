# Slice 0021 — Local Worker wake contract

**Tier** — foundation-risk · **Closed** — 2026-08-14 · **Tag** — `slice-0021`

## What shipped

`npm test` covers the wake WebSocket wire on the same local Worker as the HTTP contract: a live socket gets `{ event: 'wake', payload }` after a merge; a missing or wrong token or device id is not upgraded. `/wake/` stays off `FUNCTIONS`. Expo Go is unchanged.

## Report

### Headline
A wake that omits `event`/`payload`, or a `/wake/` that opens without a token, now fails the PR.

### Highlights
- **`L-efWake`** — accepted merge → `{ event: 'wake', payload: { group_id, entity_type, id, version } }`, no entity body.
- **`wakeUrl`** — extracted so the query-string token can be tested without loading React Native.
- **D-071** — wake wire is on the local-Worker vitest. Narrows D-070. `/wake/` stays off `FUNCTIONS`.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Wake wire | Proven by two phones, or not at all | Vitest against the local Worker; part of `npm run check` |
| `/wake/` vs `FUNCTIONS` | Not on the deploy/health list | Unchanged |
| Phone | Deployed Worker | Unchanged |

### Surfaces touched

- **Client** — `src/sync/wakeUrl.ts` (extracted), `src/sync/wake.ts` (re-export); `src/api/edge.test.ts`, `src/sync/wakeUrl.test.ts`
- **Server** — none
- **State** — `LOGIC.md` (`L-wakeSub` names `wakeUrl`), `OVERVIEW.md`, `AGENTS.md`, this archive, `DECISIONS.md` (D-071), `PARKING.md`

### Decisions this slice

- D-071 — The local-Worker vitest covers the wake wire (auth + tip). Narrows D-070. `/wake/` stays off `FUNCTIONS`. Does not drive `startWakeSubscription`.

### Logic delta

- **Changed** — `L-wakeSub` (`wakeUrl` extracted; query-string token is the named URL)

### Flow delta

- **Changed** — none. `F-wake` still needs a second device to capture; the wire is now in `npm test`.

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-efAccess` on `/wake/` | missing `access_token` | WebSocket constructor errors; the socket never opens (Worker 401). Node `fetch` cannot send `Upgrade` (undici rejects the header). |
| `L-efAccess` on `/wake/` | wrong `access_token` | same failed open |
| `L-efAccess` on `/wake/` | missing or wrong `device_user_id` | same failed open |
| `L-efWake` | accepted merge while a socket is live | that socket gets `{ event: 'wake', payload: { group_id, entity_type, id, version } }` and no entity body |
| `FUNCTIONS` | `/wake/` | not on the list; health stays GET-without-Upgrade on the POST route names |

### Review

- **Invariants** — no violations. Tests stay on the local harness; no deploy, no D1 wipe, no client path to the Durable Object. D-071 names the narrowing of D-070.
- **Spec** — `L-efWake` tip and `L-wakeSub` URL covered. Out of scope kept (`startWakeSubscription`, reconnect, `/wake/` on `FUNCTIONS`). Fixed after review: missing/wrong `device_user_id`. Accepted: unauthorized is a failed WebSocket open, not an asserted HTTP 401 — undici `fetch` rejects the `Upgrade` header, and a one-off harness probe hung.
- **Standards** — importing `wakeUrl` from `wake.ts` pulled React Native into vitest. Extracted `src/sync/wakeUrl.ts` (env only) and re-exported from `wake.ts` so `L-wakeSub` still names it. Accepted: one test file for HTTP + wake on the same harness (`NEXT.md` allowed a sibling).

### Shots

No capture: no surface changed. Demo is `npm test`. `F-wake` stays unrecorded (second device).

### Diff pulse

`+234 / −18 · 10 files` — from `git diff --cached --stat` at close

## Questions asked and answered

- **Recommended pick?** → Wake socket contract against a local Worker.
- **Depth?** → Wire only (auth + tip after merge). Not `startWakeSubscription`, not reconnect.

## What was parked during this slice

- Driving `startWakeSubscription` against the local Worker → PARKING (foundation-risk)
- Reconnect / backoff → already `wakePolicy` tests
- Capture in CI → PARKING
- Expo Go against `wrangler dev` → PARKING

## Notes

Node `fetch` (undici) cannot send `Upgrade`; the contract uses undici's `WebSocket` (CI is Node 20, which has no global `WebSocket`). `createTestHarness` listen URL supports that upgrade.
