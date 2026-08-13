# Slice 0013 — dev remote

**Tier** — foundation-risk

## Goal

A slice that has not merged can be demoed on a phone: Expo Go and `npm run web` talk to a persistent `splitnext-v3-dev` that CI updates on every `slice/**` push. Prod (`splitnext-v3`) still moves only when `main` merges (D-052).

## Before → After

| | Now | After |
| --- | --- | --- |
| Unmerged server change | 404 until the PR lands. `F-invite` / `F-join` shipped unrecorded for this reason | Push the slice branch; `L-efHealth` on **dev** reports that commit |
| Local `.env` | Placeholder; easy to point a phone at prod | `.env.example` is the real **dev** URL + anon key. `cp .env.example .env` is the setup |
| Prod deploy | `supabase.yml` on `main` only. No `workflow_dispatch` (D-052) | Unchanged. Dev is a second target, not a second way to touch prod |
| Dev schema vs this repo | No dev project | New `splitnext-v3-dev` (eu-central-1). Additive `db push` on each slice push. Wipe + replay migrations only via `workflow_dispatch` at the start of a server slice |
| `evaluate` / `L-efHealth` | One remote, the merge sha | Same probe, two remotes: prod = `main` sha, dev = the slice-branch sha |

## Plan

1. Create persistent project `splitnext-v3-dev` in the same org, `eu-central-1`. Do not revive `splitnext-preview`. First deploy is an empty database + this repo's migrations.
2. Add GitHub secrets for the dev anon key (and the project ref if it is not committed). Existing `SUPABASE_ACCESS_TOKEN` stays the login. Pages keeps `EXPO_PUBLIC_SUPABASE_*` aimed at **prod**.
3. New pure seam `targetFor` (`L-deployTarget`) — given GitHub `event` + `ref`, return `prod` / `dev` / `none`, and whether this run may reset. Tests pin: `push` `main` → prod, no reset; `push` `slice/**` → dev, no reset; `workflow_dispatch` on `slice/**` → dev, reset; anything on `main` other than `push` → none.
4. One deploy path, two callers. Prod workflow stays `push` `main` only — no `workflow_dispatch`. Slice-branch workflow: `push` `slice/**` runs `db push` + stamp sha + `FUNCTIONS` deploy + `evaluate` against **dev**; `workflow_dispatch` wipes the dev database, then the same deploy. Both reuse `evaluate` / `L-efHealth`.
5. `.env.example` gets the real dev URL and anon key. `AGENTS.md`: local `.env` is dev; never hand-deploy **prod**; a slice-branch push is how **dev** moves; reset is the dispatch at the start of a server slice. Local `supabase start` stays the contract-test item.
6. D-058: D-052 still governs prod; slice-branch CI may deploy to `splitnext-v3-dev`. `workflow_dispatch` exists only as the dev reset, never on prod.

## Seams under test

| Seam | Behavior |
| --- | --- |
| `L-deployTarget` `targetFor` | Which remote a GitHub event+ref may touch, and whether that run may wipe. The workflows call this; they do not re-encode the table. |
| `evaluate` | Unchanged: every name in `FUNCTIONS` must report the sha this run deployed. Pointed at prod or at dev by the caller. |

## Acceptance

- Push this slice branch. `curl` **dev** `fetch-entity?health=1` returns this commit's sha. `curl` **prod** `fetch-entity?health=1` still returns the sha currently on `main`.
- `cp .env.example .env`, `npm run web`, create a group — it exists on **dev**, not on prod.
- `npx python3 -m unittest` (via `npm run test:board`) covers every `targetFor` row above, and existing `evaluate` cases still pass.
- Prod `supabase.yml` still has no `workflow_dispatch`.

## Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| | | |

## Out of scope

- Contract test against a local Supabase stack — parked (foundation-risk). `supabase start` stays that item, not the Expo Go target.
- Preview deploys per PR (Pages / app URL per branch) — parked (breadth)
- Hand-deploy to prod — forbidden (D-052)
- Revive `splitnext-preview` — declined
- Invite rate limits, Realtime JWT, missed-wake cursor — parked, untouched

## Parked this session

- Contract test against a local Supabase stack — stays foundation-risk; this slice does not absorb it
- Preview deploys per PR — stays breadth
- Revive paused `splitnext-preview` — declined, not parked
