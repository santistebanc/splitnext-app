# Slice 0022 — Capture in CI

**Tier** — foundation-risk · **Closed** — 2026-08-14 · **Tag** — `slice-0022`

## What shipped

A PR cannot merge if a recorded flow is broken. CI boots a local Worker, starts `npm run web` against that origin, and drives capture `--assert-only`. No Cloudflare account. `npm run check` stays the four fast gates. Committed clips are still a human `npm run capture` against the deployed Worker.

## Report

### Headline
A broken Create group (or any other recorded flow) now fails the PR, with no live Cloudflare account.

### Highlights
- **`--assert-only`** — same `problems[]` as a clip run; writes no `.webm`.
- **`npm run capture:ci`** — `createTestHarness` + Metro with `EXPO_PUBLIC_API_URL` at the listen origin.
- **D-072** — `npm run check` stays the four fast gates. Capture is a second required CI job. Narrows D-046. Does not retarget D-070.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Capture | Local, against the deployed Worker; not a merge gate | CI job on PRs, against a local Worker; required to merge |
| `npm run check` | test + typecheck + test:board + audit | Unchanged (D-046's four gates stay the laptop list) |
| Clips | Written by a human `npm run capture` | Still. CI asserts; it does not commit video |
| Phone / Pages | Deployed Worker | Unchanged |

### Surfaces touched

- **Client** — none
- **Server** — none (harness loads existing `workers/wrangler.jsonc`)
- **State** — `OVERVIEW.md`, `AGENTS.md`, this archive, `DECISIONS.md` (D-072), `PARKING.md`
- **Tooling** — `docs/scripts/capture-flows.mjs`, `capture-opts.mjs`, `local-origin.mjs`, `capture-ci.mjs`, `ci_gates.py`; `.github/workflows/ci.yml`; `package.json` (`capture:ci`)

### Decisions this slice

- D-072 — `npm run check` remains the four fast gates. Capture is a second required CI job against a local Worker. Narrows D-046. Does not retarget D-070.

### Logic delta

- **Changed** — none on the map. Capture tooling is not an `L-` piece (it is not UI / Device / Edge / Server).

### Flow delta

- **Changed** — recorded `F-create` · `F-open` · `F-add-member` · `F-bind` · `F-add-expense` · `F-balances` · `F-settle` · `F-settle-record` · `F-bump` are now a merge gate (`npm run capture:ci`). Clips still come from a human `npm run capture` against the deployed Worker. Unrecorded flows stay skipped with the same reasons.

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `capture:ci` | `http://127.0.0.1:8081` already answers (including 500) | Refuses. The running Metro would still be inlined at whatever URL started it — often `workers.dev` — so driving it would not be a local-Worker run. |
| `assertLocalOrigin` / `metroEnv` | origin hostname ends with `workers.dev` | Throws. Metro never gets that URL to inline. |
| `npm run capture -- --assert-only` | a request goes to `*.workers.dev` | Logged as a problem; the run exits 1. Human clip recording (no flag) still uses the deployed Worker from `.env`. |
| `npm run capture -- --assert-only` | console error or balances/settle reload mismatch | Same `problems[]` as a clip run; exits 1; writes no `.webm`. |
| `capture:ci` | Expo exits before 8081 is ready | Wait aborts on `expoDead` instead of spinning the 180s timeout. |
| `capture:ci` | process is root (this WSL box) | Expo logs that React Native DevTools cannot start without `--no-sandbox`. Metro still serves; the browser console stays clean. GitHub's runner is not root. |
| `capture-flows.mjs` | Node 20 (CI) | `fs.promises.glob` does not exist; ffmpeg discovery walks `~/.cache/ms-playwright` with `readdir` instead. |
| `npm run check` | run on a laptop | Still the four fast gates. Does not start Playwright or Metro. |

### Review

- **Invariants** — no domain violations. Client still talks HTTP through `edge.ts`; `applyD1Migrations` is local harness setup, not `--remote`. No deploy, no wipe. D-070 holds (vitest unchanged; capture CI refuses `workers.dev`). Fixed after review: D-072 appended so the second CI job does not silently reverse D-046.
- **Spec** — all three seam rows have tests. Out of scope kept (not in `check`, no clip rewrite, no SQLite-on-web, no wake/join recording). Accepted: boot is `createTestHarness` (same as D-070; `NEXT.md` named it). Playwright install is Chromium-only, matching `chromium.launch()`. Fixed after CI: `capture-flows.mjs` imported `fs.promises.glob` (Node 22+); CI is Node 20, so ffmpeg discovery now uses `readdir`.
- **Standards** — extracted `capture-opts`, `local-origin`, and `ci_gates` rather than growing `capture-flows.mjs`. Accepted: `ASSERT_ONLY` branches stay in the recorder; Worker boot is copied from the vitest harness rather than shared (capture-ci is process wiring, not `npm test`); `waitUntilOk` stays in the orchestrator.

### Shots

No capture: no surface changed. Demo is `npm run capture:ci` (nine recorded flows, console clean, no clips written).

### Diff pulse

`+614 / −31 · 15 files` — from `git diff --cached --stat` at close

## Questions asked and answered

- **Recommended pick?** → Capture asserts in CI against a local Worker (foundation-risk).
- **How to gate without a Cloudflare account, and in `npm run check`?** → Second required CI job. Not in `check`. Local Worker. Do not rewrite clips from CI.

## What was parked during this slice

- SQLite persist on web — "web still does not exercise the SQLite persist adapter"
- Fuller failure taxonomy
- Expo Go against `wrangler dev`
- Capture clips committed from CI
- Driving `startWakeSubscription` from capture

## Notes

`createTestHarness` is the same boot as D-070; wrangler 4 marks `unstable_dev` deprecated. Metro inlines `EXPO_PUBLIC_API_URL` at start, so the CI job must spawn Expo itself. GitHub branch protection must list the `capture` job (or require every workflow job) or a red capture run would not block merge.
