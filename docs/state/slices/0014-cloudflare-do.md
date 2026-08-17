# Slice 0014 — Cloudflare Durable Object server

**Tier** — foundation-risk · **Closed** — 2026-08-13 · **Tag** — `slice-0014`

## What shipped

The phone and `npm run web` talk to one Cloudflare Worker instead of `splitnext-v3`. Same HTTP JSON, same version merge, same invites. Wake is a hibernating WebSocket on the group's Durable Object. CI is the only writer; `?health=1` still proves the sha.

## Report

### Headline
One Worker holds every group: a SQLite Durable Object per `group_id`, D1 for tokens and invites, and a hibernating socket instead of Realtime.

### Highlights
- **`GroupObject`** — one SQLite Durable Object per group; `mergeOne` uses the same `shouldAccept` the client tests.
- **D1 `splitnext-index`** — `access_tokens` and `invites` only (`token_hash → group_id`). Entities never leave the DO.
- **`L-wakeSub`** — hibernating WebSocket at `/wake/:groupId`; catch-up still maps drop then `SUBSCRIBED` (D-054).
- **CI** — `workers.yml`: D1 migrate, `wrangler deploy` with `DEPLOY_SHA`, `evaluate` on every remaining route. No `rt-jwt`. No hand deploy.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Host | Supabase Postgres + 7 Edge Functions + Realtime | Worker `splitnext`: SQLite DO per group + D1 token/invite index |
| Client env | `EXPO_PUBLIC_SUPABASE_URL` + anon key | `EXPO_PUBLIC_API_URL` → `https://splitnext.santistebanc94.workers.dev` |
| Wake | supabase-js Realtime + `rt-jwt` / anon_channel (D-006) | Hibernating WebSocket on the group DO |
| Deploy | `supabase.yml` / `db push` / `functions deploy` | `workers.yml` / D1 migrate / `wrangler deploy` |
| Existing Postgres groups | Live on `splitnext-v3` | Not migrated. Recreate. `splitnext-v3` left unused |

### Logic delta

- **Removed** — `L-edgeRtJwt` · `L-efRtJwt`
- **Changed** — `L-wakeSub` · `L-wakeCatchUp` · `L-efCreate` · `L-efMerge` · `L-efFetch` · `L-efRoster` · `L-efMintInvite` · `L-efJoin` · `L-efAccess` · `L-efWake` · `L-efHealth` · `L-efShouldAccept` · `L-deployTarget` · `L-edgeCreate` · `L-edgeMerge` · `L-edgeFetch` · `L-edgeRoster` · `L-edgeMintInvite` · `L-edgeJoin`

### Flow delta

- **Changed** — `F-create` (step 6: hibernating WebSocket, no `rt-jwt`). `F-wake-reconnect` (trigger: wake socket). `F-join` (step 5: live socket). `F-invite` / `F-join` / `F-wake` still unrecorded (second device).

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| Wake auth | React Native `WebSocket` cannot set headers | Token and `device_user_id` go on the query string of `/wake/:groupId`. They can appear in access logs. Accepted this slice. |
| Old local groups | Tokens minted against `splitnext-v3` | Sync 401s until the group is recreated on the Worker. No row copy. |
| Invite redeem race | Two devices hit the same live token | `UPDATE … WHERE redeemed_at IS NULL`; the loser gets `invite_redeemed` 409 and the invite stays one-use. |
| Bind uniqueness | Second live bind, same device, new id | SQLite partial unique index on the DO. The POST 500s (`internal`). Re-choose (D-021) upserts the existing bind id and succeeds. |
| Failed wake | `ws.send` throws after an accepted merge | The write stays; wake is best-effort. |
| Health vs work | `GET ?health=1` on a route name | POST is never a health request. `/wake/` is not in `FUNCTIONS`. |
| Create then token insert | DO insert succeeds, D1 insert throws | Orphan group row, no token. Recreate with a new id. |
| `DEPLOY_SHA` unset | `--var` missing on deploy | Health returns `revision: "unknown"`; `evaluate` fails the run. |
| Health probe | urllib default User-Agent / stale isolate | Probe sends `User-Agent: splitnext-verify-deploy` and retries until the sha matches. |

### Review

- **Invariants** — cents stay integers; merge is version-only; deletes are soft; the client talks only to the Worker. Close writes D-060–D-064 so D-001 / D-006 / D-052 / D-053 / D-058 are not silently reversed.
- **Spec** — Worker path matches the plan. Seams have tests; added a non-JSON `evaluate` case. `F-invite` / `F-join` stay unrecorded (second device); demoed by hand. Bind unique-index clash returns HTTP 500 for a new bind id — accepted: the client re-points the existing id (D-021).
- **Standards** — `edge.ts` stays the HTTP seam; `mergeOne` is extracted and tested. Accepted: `GroupObject` still owns schema + SQL + hibernation (thin slice). Dropped a duplicate bearer check in `handleMerge`. Wake keeps Realtime status names so `wakePolicy` is unchanged.

### Shots

- `flows/F-create.webm` — create group against the Worker
- `flows/F-open.webm` — open a group from the lobby
- `flows/F-add-member.webm` — add a name-slot member
- This is me (F-bind clip dropped in 0027 when bind lost its own surface)
- `flows/F-add-expense.webm` — record an expense
- `flows/F-balances.webm` — balances survive a reload
- `flows/F-bump.webm` — bump name (merge + wake)
- `F-invite` / `F-join` / `F-wake` / `F-wake-reconnect` stay unrecorded (second device)

### Surfaces touched

- **Client** — `src/api/edge.ts`, `src/config/env.ts`, `src/sync/wake.ts`
- **Server** — `workers/` (Worker + `GroupObject` + D1 migrations)
- **CI** — `.github/workflows/workers.yml`, `deploy-workers.yml`; `docs/scripts/deploy_target.py`, `verify_deploy.py`
- **State** — `LOGIC.md`, `FLOWS.md`, `OVERVIEW.md`, `AGENTS.md`, this archive, `DECISIONS.md` (D-060–D-064), `PARKING.md`

### Decisions this slice

- D-060 — Host is Cloudflare Worker `splitnext`; SQLite Durable Object per group; D1 `splitnext-index` for tokens and invites. Supersedes D-001.
- D-061 — Wake is a hibernating WebSocket on the group DO. D-006 is obsolete.
- D-062 — CI is the only writer: D1 migrate + `wrangler deploy` + health sha. Retargets D-052; D-053 is obsolete.
- D-063 — `push` `main` or `slice/**` deploys to this Worker. Retargets D-058.
- D-064 — Server lives under `workers/`; `supabase/migrations` stay as history.

### Diff pulse

`+3716 / −1779 · 68 files` — from `git diff origin/main --stat` at close.

## Questions asked and answered

- **Move now, or stay on Supabase Pro?** → Move now. Full port in one slice.
- **PartyKit + KV?** → KV cannot do the version merge or one-use invites. SQLite DO per group; D1 only as the token index.

## What was parked during this slice

- Per-PR Worker + staging D1 → PARKING (breadth)
- EU Durable Object jurisdiction → PARKING (foundation-risk)
- Contract test against `wrangler dev` → PARKING (foundation-risk)
- Realtime JWT signing secret (D-006) → obsolete

## Notes

Wake auth is query params because React Native `WebSocket` cannot set headers. Token-in-URL logs are accepted this slice. First wrangler deploy must be `wrangler deploy` (DO class lifecycle), not `versions upload`.
