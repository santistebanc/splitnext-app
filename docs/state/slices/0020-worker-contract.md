# Slice 0020 — Local Worker contract

**Tier** — foundation-risk · **Closed** — 2026-08-14 · **Tag** — `slice-0020`

## What shipped

`npm test` boots the Worker locally (empty D1 + Durable Objects, no remote) and drives every HTTP route in `FUNCTIONS` through `src/api/edge.ts`. A response shape that client cannot parse fails the PR. Expo Go still talks to the deployed Worker.

## Report

### Headline
Worker HTTP shapes are a merge gate: vitest boots a local Worker and fails the PR if `create-group` omits a token or `list-roster` drops `expenses`.

### Highlights
- **`src/api/edge.test.ts`** — `createTestHarness` + local D1 migrations; create → merge member → fetch → roster → mint → join as a second device; `GET ?health=1` on every `FUNCTIONS` name.
- **`env.apiUrl`** — reads `EXPO_PUBLIC_API_URL` on access, not at import, so the suite can point at the listen URL. The app still uses `.env`.
- **D-070** — this local-Worker vitest is the HTTP contract. Narrows D-018 without reviving the fake `edge.ts` server. Does not hit `workers.dev`.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Worker HTTP shapes | Proven by capture against the remote, or not at all | Vitest against a local Worker; part of `npm run check` |
| Health | Remote `?health=1` after deploy (`L-efHealth`) | Same payload locally on every `FUNCTIONS` route, plus the write/read round trip |
| Phone | Deployed Worker | Unchanged |

### Surfaces touched

- **Client** — `src/config/env.ts` (lazy `apiUrl`); `src/api/edge.test.ts`, `src/config/env.test.ts`
- **Server** — none (harness loads existing `workers/wrangler.jsonc`)
- **State** — `OVERVIEW.md`, `AGENTS.md`, this archive, `DECISIONS.md` (D-070), `PARKING.md`

### Decisions this slice

- D-070 — The HTTP contract is vitest against a local Worker, gated in `npm test`. Narrows D-018 without reviving the fake. Does not retarget D-019. Never hits `workers.dev` from vitest.

### Logic delta

- **Changed** — none on the map (`L-edgeCreate` · `L-edgeMerge` · `L-edgeFetch` · `L-edgeRoster` · `L-edgeMintInvite` · `L-edgeJoin` · `L-efHealth` behaviour unchanged; tests now sit on those seams)

### Flow delta

- **Changed** — none. Capture still drives the deployed Worker.

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-edgeCreate` | `group_id` / `device_user_id` empty | Worker 400 `invalid_body`; `createGroupRemote` throws that name |
| `L-edgeMerge` | member version not greater | result `status` is `rejected`, `reason` `version_not_greater`; fetch/roster still see the live row |
| `L-edgeRoster` | group has members but no expenses | `expenses` is still an array (empty), not omitted |
| `L-efHealth` | local Worker, `DEPLOY_SHA` unset | every name in `FUNCTIONS` still answers `{ ok: true, fn, revision: "unknown" }` |
| `src/config/env.ts` | `EXPO_PUBLIC_API_URL` unset | throws on first `apiUrl` read, not at import, so the contract suite can point at the listen URL |
| `L-edgeCreate` | harness origin would be `workers.dev` | `beforeAll` refuses to start; vitest never calls the deployed Worker |

### Review

- **Invariants** — no violations. Client still talks HTTP through `edge.ts`; `applyD1Migrations` is local harness setup, not `--remote`. No deploy, no wipe. D-070 names the narrowing of D-018 rather than silently reversing the fake-server decision.
- **Spec** — all four seam rows have tests. Out of scope kept. Fixed after review: stale merge now re-fetches/lists the live row; health asserts `revision: "unknown"`; `env.apiUrl` throw-on-read is tested. Accepted: boot is `createTestHarness` (current wrangler API) rather than the plan's `unstable_dev` example.
- **Standards** — no new production seam; `edge.ts` stays the HTTP boundary. Accepted: health uses raw `GET` because `edge.ts` has no GET client; `FUNCTIONS` is scraped from `verify_deploy.py` so the deploy list is the one list. Extracted `seededMember` for the duplicated merge setup.

### Shots

No capture: no surface changed. Demo is `npm test`.

### Diff pulse

`+374 / −14 · 8 files` — from `git diff --cached --stat` at close

## Questions asked and answered

- **Recommended pick?** → Contract test against a local Worker (foundation-risk).
- **Gate in `npm run check` / CI?** → Yes.
- **Would Expo Go on the phone work with the local Worker?** → No change this slice; phone keeps `EXPO_PUBLIC_API_URL`. Tests boot a separate miniflare Worker.

## What was parked during this slice

- Expo Go against `wrangler dev` → PARKING (breadth)
- Capture in CI → PARKING (already foundation-risk as browser-driven flow tests)
- Wake socket contract against local Worker → PARKING (foundation-risk)

## Notes

`createTestHarness` replaced the plan's `unstable_dev` / vitest-pool examples; wrangler 4.122 marks `unstable_dev` deprecated. Local listen is ~2s. Metro still inlines `EXPO_PUBLIC_API_URL` in the app bundle, so the getter does not retarget Expo Go.
