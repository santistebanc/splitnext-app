# Slice 0010 — deployed is what is committed

**Tier** — foundation-risk · **Closed** — 2026-08-12 · **Tag** — `slice-0010`

## What shipped

Merging to `main` is now the only way the server moves. CI pushes migrations, redeploys all five Edge Functions, stamps them with the merge sha, and fails unless every function answers `?health=1` with that sha. Nobody gains a feature; "slice N shipped the expenses table" becomes a checkable statement.

## Report

### Headline
The remote can no longer silently lag behind the repo — a deploy that does nothing goes red, and the only path to the server is a green merge.

### Highlights
- **`L-efHealth`** — every Edge Function answers `GET ?health=1` with `{ ok, fn, revision }` before any auth; unauthenticated on purpose (public repo sha + function name).
- **`verify_deploy.py`** — pure `evaluate` decides pass/fail; the HTTP half retries transport failures, never 4xx/5xx. The function list is also the deploy list.
- **`supabase.yml`** — independent of Pages; serialised; no `workflow_dispatch`; no database password (CLI mints a login role from the access token).
- **Migration stamps aligned** — the five local files were renamed to the remote history versions so the first CI `db push` is a no-op rather than a false conflict.
- **Hand-deploy is forbidden** — `AGENTS.md` says so; a migration or function is shipped when its PR merged green, and not before.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Migrations | Applied by hand whenever someone remembered | `supabase db push` on every merge to `main` |
| Edge Functions | Deployed by hand; stale ones looked healthy | All five redeployed on merge; health stamp required |
| "What is running?" | Unanswerable without the dashboard | `GET …?health=1` returns the deploy sha |
| Silent no-op deploy | Green | Red — verifier names every stale or missing function |
| CI workflows | `ci`, `delta`, `pages` | Plus `supabase.yml`, independent of Pages |

### Logic delta

- **Added** — `L-efHealth` (`isHealthRequest` / `healthPayload`)

### Flow delta

- Unchanged. No app behaviour moved; no flow was re-recorded.

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `verify_deploy.py` | Run against the real pre-slice deployment, which has no health branch | All five fail with `answered HTTP 405, not 200`, exit 1. Ran it — this is the proof the tail is not decorative, and it also confirmed the five functions are reachable and the anon-key header is what the gateway wants. |
| `verify_deploy.py` | Host unreachable (function still cold, or DNS down) | Each probe retries 5 times with a 0/2/4/6/8s backoff before reporting `did not answer: …`. Verified against a closed port: retries happen, then it fails with the transport error named. Worst case is ~150s before the job goes red. |
| `verify_deploy.py` | Function answers 4xx/5xx | Reported as the answer it is, not retried — retrying a verdict just delays the same red. |
| L-efHealth | `DEPLOY_SHA` unset (secret never propagated) | Function answers `ok: true, revision: "unknown"`; the verifier fails it by name. Liveness and provenance stay separate answers. |
| L-efHealth | A `POST` carrying `?health=1` | Not a health request — the probe is GET-only, so it can never shadow a merge, and the OPTIONS preflight still answers first. Covered by tests. |
| L-efHealth | Unauthenticated caller | Answered. It discloses a commit sha of a public repo and the function's own name; nothing is behind it. |
| `supabase.yml` | Two merges land close together | `concurrency: supabase` serialises them and `cancel-in-progress: false` keeps a `db push` from being killed half-applied. |
| `supabase.yml` | `db push` succeeds but leaves migrations pending | The `--dry-run` tail greps for "up to date" and fails otherwise. If the CLI ever rewords that line this false-fails — loudly, which is the safe direction. |
| `supabase.yml` | `SUPABASE_ACCESS_TOKEN` missing | Fails at `supabase link`, before anything is touched. Observed once before the secret was set from `~/.supabase/access-token`; set now. No `SUPABASE_DB_PASSWORD` — the CLI mints a login role from the access token. |
| Migrations | Local files stamped differently from the remote history (hand-applied under other clocks) | Renamed the five local files to the remote version numbers so `db push --dry-run` reports "up to date". Same SQL; history is what was drifted. |
| `supabase.yml` | Supabase is down | `pages.yml` is untouched, so the board and app still publish — and the board is where you go to see that deploy went red. |

### Review

- **Invariants** — clean (D-052 / D-053 appended; no silent reverse).
- **Spec** — clean on the plan. Accepted one unplanned extra: `audit-state.py` treats a claimed-but-missing `slice-NNNN` tag as a note on a slice branch and a finding on `main`, so the PR-per-slice + tag-after-merge order (D-028) can go green. Named in Notes.
- **Standards** — clean. Five identical health hooks kept as thin Deno wiring so `health.ts` stays Deno-free and testable.

### Shots

No UI. The demo is the verifier failing against the pre-slice deploy (`HTTP 405` on all five) and, after merge, `curl …/fetch-entity?health=1` returning the merge sha. Nothing to put in `docs/state/shots/`.

### Surfaces touched

- **Client** — none
- **Server** — `supabase/functions/_shared/health.ts` + one-line hook in all five functions; migration filenames aligned to remote history
- **CI** — `.github/workflows/supabase.yml`, `docs/scripts/verify_deploy.py`, `docs/scripts/audit-state.py` (branch tag note)
- **State** — `LOGIC.md` (+L-efHealth), `AGENTS.md`, `OVERVIEW.md`, this archive, `DECISIONS.md` (D-052, D-053)

### Decisions this slice

- D-052 — Merging to `main` is the only way the server moves
- D-053 — CI authenticates `db push` via access-token login role, not a database password

### Diff pulse

`+653 / −13 · 24 files` — from `git diff --cached --stat` at close

## Questions asked and answered

- **Can the agent fetch the deploy secrets itself?** → Access token yes (`~/.supabase/access-token` → GitHub secret). Database password no (never returned); dropped from the workflow instead (D-053).

## What was parked during this slice

- Preview deploys per PR → PARKING (breadth)
- Contract test against a local Supabase stack → PARKING (foundation-risk)
- Delta matches symbol names as plain English words → PARKING (polish, raised this slice)

## Notes

- Tag `slice-0010` lands on `main` after the squash merge, not on the branch tip. Until then `npm run audit` notes the missing tag on the slice branch and would find it on `main`.
- First post-merge proof: `curl 'https://ycpkguwfxlhpovnsuujr.supabase.co/functions/v1/fetch-entity?health=1' -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY"` must return the merge sha.
