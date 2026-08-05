# Slice 0004 — sync quality harden

**Tier** — foundation-risk · **Closed** — 2026-08-05 · **Tag** — `slice-0004`

## What shipped

Sync stopped being one fat orchestrator. `groupSync` is now a facade over four modules that each do one thing — flush, apply, subscribe, and describe failures — and every flow has a test that runs the real client against a fake edge server in process.

## Questions asked and answered

- **Can queue identity be `id` alone?** No. Two versions of the same entity share an id, so an accepted v2 was dropping a pending v3. Identity is `entity_type + id + version`, and the server now returns those on every merge result.
- **Where is the seam for testing a flow?** `src/api/edge.ts` — the single wire boundary. Faking that one module runs everything else for real, with no device and no network.
- **Should flow tests gate every commit?** No. Commits inside a slice are work-in-progress by design; a gate there gets bypassed rather than obeyed. They gate the demo gate and the close.

## What was parked during this slice

- Contract test of the fake edge server against a local Supabase stack (the fake imports the real `shouldAccept`, but response shapes can still drift)
- Symbol-level change attribution on the board (mapping is file-level, so a shared file drags its neighbours in)
- Hub UI file split / design system, lobby ids out of Secure Store, full missed-wake protocol, Realtime JWT signing — untouched, as scoped

## Report

### Headline

Sync is now four small modules behind a facade, with typed clearable errors, exact queue identity, and a test per flow.

### Highlights

- `groupSync` reduced to a facade; five functions moved out to `outbound`, `inbound`, `wake`, `exclusive` — same interfaces, new homes
- Queue drops only the exact `entity_type + id + version` the server accepted
- `lastError` is `{ code, message, at }`, cleared on success and coerced from old string data
- Flow test harness: fake edge server + two-device support, in process, ~0.8s for 47 tests
- Every one of the 8 flows has a test naming its id; the board reads coverage from the test files

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| `groupSync.ts` | Fat orchestrator (~400 lines) | Thin facade over outbound / inbound / wake |
| Queue after merge | Drop by `id` only | Drop by `entity_type + id + version` |
| Merge results | No version on result | Include `entity_type` + `version` |
| `lastError` | String prefixes; sticky | Typed `{ code, message, at }`; clear on success |
| Sync tests | Pure helpers only | 8 flow tests + seams; 47 tests total |

### Logic delta

- **Added** — `L-syncError` (new module) · `L-applyRemoteEntity` (pure apply, extracted from a private helper and now unit-tested) · `L-commitRemote` (the store write that helper used to do inline) · `L-shouldFlush` (existing rule, split out of `L-queuePolicy` in the map so a flow can cite the right half)
- **Changed** — `L-flushQueue` · `L-applyRemoteFetch` · `L-pullRoster` · `L-wakeSub` · `L-runExclusive` (all five existed inside `groupSync.ts` and moved to their own modules; interfaces unchanged) · `L-syncGroup` (step 2 flush moved out) · `L-createGroup` (wake failure no longer fails create) · `L-queuePolicy` (drops by full identity) · `L-edgeMerge` (result shape) · `L-efMerge` (returns `entity_type` + `version`) · `L-hub` (typed error display)

### Flow delta

- **Changed** — `F-sync` (steps 2, 3 and 4 now live in their own modules) · `F-open` (step 2 wake failure is swallowed) · `F-create` (step 6 wake failure is recorded, not thrown)

### Surfaces touched

- **Client** — `src/sync/` split into `outbound` / `inbound` / `inboundApply` / `wake` / `exclusive` / `syncErrors`; hub renders typed errors
- **Server** — `merge` returns `entity_type` + `version` per result
- **Tests** — `src/flows/` harness + one test file per flow; `vitest.config.ts` alias + setup
- **State** — LOGIC/FLOWS rewritten with Kind and areas; board regenerated

### Decisions this slice

- D-016 — Queue identity is `entity_type + id + version`
- D-017 — `lastError` is a typed `SyncError`, cleared on success
- D-018 — Flow tests fake `src/api/edge.ts` and import the server's real version rule
- D-019 — Flow tests gate the demo gate and the close, not each commit

### Diff pulse

`11 files changed, 1765 insertions(+), 464 deletions(-)`
