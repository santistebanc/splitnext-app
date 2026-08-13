# Slice 0013 — one remote, slice branches may deploy

**Tier** — foundation-risk

## Goal

An unmerged slice can be demoed on a phone against the same `splitnext-v3` the published app uses. There is no second project. CI on `main` and on `slice/**` both deploy there; last green run wins. Nobody wipes that database.

## Before → After

| | Now | After |
| --- | --- | --- |
| Unmerged server change | 404 until the PR lands | Push the slice branch; `L-efHealth` on `splitnext-v3` reports that commit. The published app runs those functions until `main` deploys again |
| Local `.env` | Placeholder | `.env.example` is the real `splitnext-v3` URL + anon key. `cp .env.example .env` is the setup |
| Who may deploy | `push` `main` only (D-052) | `push` `main` or `push` `slice/**`. Still no `workflow_dispatch`, still no hand deploy |
| Second project | Wanted `splitnext-v3-dev` | None. Reset is gone — this database is not disposable |
| `evaluate` / `L-efHealth` | Merge sha on the one remote | Same probe, same remote, sha of whichever branch CI last deployed |
| Phone demo from the PR | Hunt for the Pages URL | CI comment includes a Camera-scannable QR of the published `/app` (`L-prPhone`) |

## Plan

1. `L-deployTarget` `target_for`: `push` `main` → this project, no reset; `push` `slice/**` → this project, no reset; anything else (including `workflow_dispatch`) → none. `github_output` refuses `reset=true` even if forced.
2. One workflow, one concurrency group. `supabase.yml` triggers on `main` and `slice/**`. No `workflow_dispatch`. No reset step. Same `db push` + stamp + `FUNCTIONS` + `evaluate` path.
3. `.env.example` gets the real `splitnext-v3` URL and anon key. `AGENTS.md`: local `.env` is that project; a slice-branch push is how an unmerged server change becomes demoable; never hand-deploy; never reset the remote. Local `supabase start` stays the contract-test item.
4. D-058: D-052 still forbids hand deploy and `workflow_dispatch`. It no longer means “only `main`.” `slice/**` CI may deploy to the same project. Last deploy wins. Migrations are additive and are not undone if the slice is abandoned.
5. `L-prPhone`: every PR comment includes a QR of the published web app. Camera app, not Expo Go. The client in the QR is `main` until this merges; this PR's functions are already on `splitnext-v3` once supabase CI is green.

## Seams under test

| Seam | Behavior |
| --- | --- |
| `L-deployTarget` `targetFor` | `push` `main` and `push` `slice/**` both deploy to `splitnext-v3` with `reset=false`. Dispatch, other branches, and pull requests are none. Reset is refused even if forced. |
| `evaluate` | Unchanged: every name in `FUNCTIONS` must report the sha this run deployed. |
| `L-prPhone` `phone_section` | Markdown QR of the published `/app`, image hosted from this commit, no `exp://`. |

## Acceptance

- Push this slice branch. `curl` `splitnext-v3` `fetch-entity?health=1` returns this commit's sha (not the previous `main` sha).
- `cp .env.example .env`, `npm run web`, create a group — it exists on `splitnext-v3`.
- `npm run test:board` covers every `target_for` row above; existing `evaluate` cases still pass.
- No `workflow_dispatch` on `supabase.yml`. No reset step. No second project.
- The PR comment includes a Camera-scannable QR of https://santistebanc.github.io/splitnext-app/app/.

## Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-deployTarget` `target_for` | `workflow_dispatch` / a PR / a non-`slice/**` branch | Decision is none. `github_output` raises; the reusable workflow never links or pushes. `supabase.yml` has no dispatch trigger, so this is belt-and-braces. |
| `L-deployTarget` `github_output` | `reset=true` even if a caller forced it | Raises `"reset is never allowed"`. There is no reset step in the workflow. |
| Two pushes at once | `main` and a `slice/**` (or two slices) both green | Concurrency group `supabase`, `cancel-in-progress: false`. The second waits. Last green run's sha is what `?health=1` reports. A cancelled `db push` would be a half-applied migration; we queue instead. |
| Slice abandoned after CI deployed | PR closed unmerged | Functions stay at that sha until the next green `main` or `slice/**` deploy. Additive migrations stay on `splitnext-v3`; they are not undone. |
| Published `/app` while a slice is in flight | Slice CI already deployed | Pages still serves `main`'s client. Edge Functions and schema are the slice's until `main` deploys again. That is the trade this slice accepted. |
| Phone QR | Scanned with Expo Go | Expo Go expects `exp://`. This QR is https; use the Camera app. Expo Go still needs `npm start` on a reachable machine. |
| Phone QR | This PR only changed the client | The QR still opens `main`'s `/app`. Per-PR app previews stay parked. |

## Out of scope

- A separate `splitnext-v3-dev` project — declined this session
- Wiping / resetting the remote — declined; one shared database
- Contract test against a local Supabase stack — parked (foundation-risk)
- Preview deploys per PR — parked (breadth)
- Hand-deploy — forbidden
- Invite rate limits, Realtime JWT, missed-wake cursor — parked, untouched

## Parked this session

- Separate `splitnext-v3-dev` — declined; one remote
- Pause old `splitnext` / upgrade to Pro — not needed
- Neon / Deno / Ably combo — parked as a future backend question (`docs/research/cheap-dev-backend.md`)
- Contract test against a local Supabase stack — stays foundation-risk
- Preview deploys per PR — stays breadth
