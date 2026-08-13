# Slice 0013 — one remote, slice branches may deploy

**Tier** — foundation-risk · **Closed** — 2026-08-13 · **Tag** — `slice-0013`

## What shipped

`push` to `main` or to a `slice/**` branch deploys to the one `splitnext-v3` project. Last green CI wins. Nobody wipes that database. `.env.example` is the real URL + anon key. Every PR comment carries a Camera QR of the published web app. Joiners subscribe for wakes on the hub, not on the join spinner.

## Report

### Headline
An unmerged slice can be demoed against the same remote the published app uses — no second project, no wipe, last green run wins.

### Highlights
- **`L-deployTarget`** — `target_for`: `push` `main` or `push` `slice/**` → this project, `reset=false`. Dispatch, other branches, PRs → none. Reset is refused even if forced.
- **One workflow** — `supabase.yml` on `main` and `slice/**`; concurrency group `supabase`; `cancel-in-progress: false`; no `workflow_dispatch`; no reset step.
- **`L-prPhone`** — CI comment includes a Camera-scannable QR of `/app`. Expo Go still needs `npm start`.
- **Joiners hear wakes** — `joinGroup` no longer starts the socket on the spinner that unmounts; the hub starts or replaces a dead channel (`shouldReplaceSubscription`).

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Unmerged server change | 404 until the PR lands | Push the slice branch; `?health=1` reports that commit |
| Who may deploy | `push` `main` only (D-052) | `push` `main` or `push` `slice/**`. Still no dispatch, still no hand deploy |
| Second project | Wanted `splitnext-v3-dev` | None. This database is not disposable |
| Local `.env` | Placeholder | `.env.example` is the real `splitnext-v3` URL + anon key |
| Phone from the PR | Hunt for the Pages URL | Camera QR of the published `/app` on the PR comment |
| Joiner live updates | Socket started on `/join`, then skipped on the hub | Hub starts (or replaces) the live channel |

### Logic delta

- **Added** — `L-deployTarget` · `L-prPhone`
- **Changed** — `L-wakeCatchUp` (also `shouldReplaceSubscription`) · `L-wakeSub` · `L-joinGroup` (does not subscribe; the hub does)

### Flow delta

- **Changed** — `F-join` (step 5: hub opens and subscribes after redeem). `F-wake` still unrecorded (second device).

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-deployTarget` `target_for` | `workflow_dispatch` / a PR / a non-`slice/**` branch | Decision is none. `github_output` raises; the reusable workflow never links or pushes. |
| `L-deployTarget` `github_output` | `reset=true` even if a caller forced it | Raises `"reset is never allowed"`. There is no reset step in the workflow. |
| Two pushes at once | `main` and a `slice/**` (or two slices) both green | Concurrency group `supabase`, `cancel-in-progress: false`. Last green run's sha is what `?health=1` reports. |
| Slice abandoned after CI deployed | PR closed unmerged | Functions stay at that sha until the next green deploy. Additive migrations stay; they are not undone. |
| Published `/app` while a slice is in flight | Slice CI already deployed | Pages still serves `main`'s client. Edge Functions and schema are the slice's until `main` deploys again. |
| Phone QR | Scanned with Expo Go | Expo Go expects `exp://`. This QR is https; use the Camera app. |
| `L-wakeSub` | Joiner subscribed on `/join`, then the hub opened | The spinner unmounted; the hub skipped a second subscribe. Joiners were deaf. Fixed: subscribe on the hub; replace a dropped channel. |
| `L-wakeCatchUp` `shouldReplaceSubscription` | Channel `SUBSCRIBED` | Reused. Covered by test. |
| `L-wakeCatchUp` `shouldReplaceSubscription` | Channel `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED` | Replaced so the hub can listen. Covered by test. |

### Review

- **Invariants** — D-052 still forbids hand deploy and `workflow_dispatch`; D-058 says `slice/**` may deploy to the same project. Anon key in `.env.example` is the public client key (already in the Pages bundle), not the service role. No wipe. Money still integer cents. Clients still never talk to Postgres.
- **Spec** — the second-project plan was rescoped in session to one remote (user). QR on the PR was added mid-slice at user request (`L-prPhone`). Joiner wake fix was not in `NEXT.md`; accepted as the demo of the shared remote did not work for the joining phone.
- **Standards** — `L-deployTarget` is the decision seam; workflows call it. Holding Realtime clients in a Map is so the socket is not GC'd. Accepted: GitGuardian flags the public anon JWT in `.env.example`; it is meant to ship.

### Shots

No new UI. The demo is `curl …/fetch-entity?health=1` returning the slice-branch sha, and two phones on Expo Go seeing an expense wake after the joiner-hub fix. `F-wake` stays unrecorded (needs a second device).

### Surfaces touched

- **Client** — `src/sync/wake.ts`, `src/sync/wakePolicy.ts`, `src/sync/invite.ts`
- **CI** — `.github/workflows/supabase.yml`, `deploy-supabase.yml`, `delta.yml`; `docs/scripts/deploy_target.py`, `docs/scripts/pr_phone.py`
- **State** — `LOGIC.md`, `FLOWS.md`, `OVERVIEW.md`, `AGENTS.md`, this archive, `DECISIONS.md` (D-058, D-059), `PARKING.md`

### Decisions this slice

- D-058 — `push` to `main` or `slice/**` deploys to `splitnext-v3`; last green wins; never reset
- D-059 — Every PR comment includes a Camera QR of the published web app

### Diff pulse

`git diff origin/main...HEAD --stat` at close — see the squash on `main`.

## Questions asked and answered

- **Second Supabase project for unmerged slices?** → No. One `splitnext-v3`. Slice-branch CI deploys there. Free plan was already at two active projects.
- **Scan code on the PR?** → Camera QR of `/app`, not Expo Go.

## What was parked during this slice

- Separate `splitnext-v3-dev` — declined; one remote
- Preview deploys per PR → PARKING (breadth)
- Contract test against a local Supabase stack → PARKING (foundation-risk)
- Neon / Deno / Ably combo → `docs/research/cheap-dev-backend.md`
