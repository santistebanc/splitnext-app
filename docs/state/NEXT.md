# Slice 0014 — Cloudflare Durable Object server

**Tier** — foundation-risk

## Goal

The phone and `npm run web` talk to one Cloudflare Worker instead of `splitnext-v3`. Same HTTP JSON, same version merge, same invites. Wake is a hibernating WebSocket on the group's Durable Object. CI is the only writer; `?health=1` still proves the sha.

## Before → After

| | Now | After |
| --- | --- | --- |
| Host | Supabase Postgres + 7 Edge Functions + Realtime | One Worker: SQLite Durable Object per group + D1 `splitnext-index` for token/invite lookup |
| Client env | `EXPO_PUBLIC_SUPABASE_URL` + anon key | `EXPO_PUBLIC_API_URL` → `https://splitnext.santistebanc94.workers.dev` |
| `L-edgeCreate` … `L-edgeJoin` | `…/functions/v1/{name}` + `apikey` | Same path names on the Worker; no anon key |
| `L-wakeSub` | supabase-js Realtime + `L-efRtJwt` / anon_channel (D-006) | Hibernating WebSocket on the group DO; `rt-jwt` gone |
| `L-efMerge` / `L-efShouldAccept` | Deno Edge Function, service-role Postgres | Same `shouldAccept` inside the group DO; single-threaded, no merge race |
| `L-efAccess` | `access_tokens` row in Postgres | D1 `token_hash → group_id` then the DO checks device + revoke |
| `L-efHealth` / `evaluate` | Each of 7 functions | Each Worker route still answers `GET ?health=1` with this commit's sha; `FUNCTIONS` stays the route list minus `rt-jwt` |
| `L-deployTarget` | `splitnext-v3` project ref | Cloudflare account Worker `splitnext`; still `push` `main` or `slice/**`, never wipe, never dispatch |
| Existing groups on Postgres | Live on `splitnext-v3` | Not migrated. New creates go to Cloudflare. Old local groups fail sync until recreated |
| `splitnext-v3` | CI deploys it | CI stops deploying it. Project left in place, unused |

## Plan

1. Worker at `workers/` (wrangler): router for `create-group`, `merge`, `fetch-entity`, `list-roster`, `mint-invite`, `join-group`. One SQLite Durable Object class `GroupObject` per `group_id`. D1 binding `INDEX` = `splitnext-index` (`dd117f7b-8096-4dad-8a97-ac9c03026262`).
2. Port `shouldAccept` + row checks (`L-efShouldAccept`, payer in group, bind's member in group, one live bind per device) into the DO. D1 holds `access_tokens` and `invites` only (hash lookup so join can find the DO). Same JSON bodies/results as today so `src/api/edge.ts` stays the seam.
3. Hibernating WebSocket on the DO replaces Realtime. Wake payload stays a tip (`group_id`, `entity_type`, `id`, `version`). `L-wakeCatchUp` maps close/open to the same catch-up rule (subscribed-again after a drop). Delete `L-efRtJwt` / `mintRealtimeAuth`.
4. `src/config/env.ts`: `EXPO_PUBLIC_API_URL`. `.env.example` is the workers.dev URL. Drop supabase-js from the wake path.
5. CI: `workers.yml` (or retarget `supabase.yml`) — `L-deployTarget` still yes only for `push` `main` / `slice/**`. Steps: D1 migrations apply `--remote`, `wrangler deploy` with `DEPLOY_SHA=$GITHUB_SHA`, `evaluate` against the Worker URL. Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. No hand deploy. No `workflow_dispatch`. Concurrency queued, not cancelled.
6. D-001 / D-006 / D-052: new decisions — host is this Worker; D-006 obsolete; D-052's "only CI writes + health sha" still holds, target is Cloudflare. D-058 still means slice branches may deploy to the one remote.

## Seams under test

| Seam | Behavior |
| --- | --- |
| `L-efShouldAccept` `shouldAccept` | Unchanged: incoming wins only when strictly greater. Worker imports the same module the tests do. |
| `L-efHealth` `isHealthRequest` / `healthPayload` | `GET ?health=1` on each remaining route returns `{ ok, fn, revision }` for this sha; POST is not a health request. |
| `L-deployTarget` `target_for` | `push` `main` and `push` `slice/**` deploy to Worker `splitnext` with `reset=false`. Dispatch / other refs are none. Reset refused. |
| `evaluate` | Every name in `FUNCTIONS` (no `rt-jwt`) must report the sha. Missing / wrong revision / non-JSON still fail. |
| `L-wakeCatchUp` | Close then open again → catch-up. First connect does not. A dropped socket is replaced. |
| `L-efAccess` | Unknown / revoked / wrong-device / wrong-group token → 401. Join redeem is one-use. |

## Acceptance

- Push this slice branch. `curl 'https://splitnext.santistebanc94.workers.dev/merge?health=1'` returns this commit's sha.
- `cp .env.example .env`, `npm run web`, create a group, add a member, record an expense, mint an invite, redeem it in another browser profile — all against the Worker, not `splitnext-v3`.
- Hub bump on one tab wakes the other (hibernating socket). Reconnect after a drop still runs `syncGroup`.
- `npm run check` green. Capture the flows this slice still drives (`F-create`, `F-add-member`, `F-add-expense`, `F-invite`, `F-join`, `F-bump`).
- No `supabase functions deploy` / `db push` in CI. No `rt-jwt`.

## Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| Wake auth | React Native `WebSocket` cannot set headers | Token and `device_user_id` go on the query string of `/wake/:groupId`. They can appear in access logs. Accepted this slice. |
| Old local groups | Tokens minted against `splitnext-v3` | Sync 401s until the group is recreated on the Worker. No row copy. |
| Invite redeem race | Two devices hit the same live token | `UPDATE … WHERE redeemed_at IS NULL`; the loser gets `invite_redeemed` 409 and the invite stays one-use. |
| Bind uniqueness | Second live bind, same device, new id | SQLite partial unique index on the DO. Re-choose (D-021) upserts the existing bind id and succeeds. |
| Failed wake | `ws.send` throws after an accepted merge | The write stays; wake is best-effort, same as D-008's "failed wake never undoes the write". |
| Health vs work | `GET ?health=1` on a route name | POST is never a health request, so a probe cannot shadow a merge. `/wake/` is not a `FUNCTIONS` name, so it is not probed. |
| Create then token insert | DO insert succeeds, D1 insert throws | Orphan group row, no token. Recreate with a new id. Rare; not rolled back this slice. |
| `DEPLOY_SHA` unset | `--var` missing on deploy | Health returns `revision: "unknown"`; `evaluate` fails the run. |

## Out of scope

- Copying existing `splitnext-v3` rows onto DOs — not migrated
- Deleting / pausing the Supabase project — leave it
- R2, KV as the entity store, PartyKit hosted product
- EU Durable Object jurisdiction — parked
- Per-PR preview Worker (separate D1) — parked (breadth); slice branches still deploy to the one Worker like 0013
- Invite rate limits, wake log / cursor, expense editor, settle-up
- Cloudflare MCP / dashboard clicks beyond the bootstrap already done
- Workers Free — merge needs Paid CPU; account is already on Paid

## Parked this session

- Per-PR Worker + staging D1 so a slice does not share production tokens — breadth (was "Preview deploys per PR")
- EU jurisdiction on the group DO — foundation-risk if residency matters
- Contract test against a local Worker (`wrangler dev`) instead of a local Supabase stack — foundation-risk (replaces the parked local Supabase contract test once this lands)
- Realtime JWT signing secret (D-006) — obsolete if this slice ships
