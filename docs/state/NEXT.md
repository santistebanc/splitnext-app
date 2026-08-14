# Slice 0025 — leave group

**Tier** — core-value

## Goal

On You-detail, **Leave group** (after a confirm) unbinds this device and revokes its access token. The member slot and expenses stay. The group drops off this device’s lobby. D-020 is unchanged: nobody else can **This is me** after the first expense.

## Before → After

| | Now | After |
| --- | --- | --- |
| You-detail | Net, buckets, settle | Same, plus **Leave group** (danger) |
| Confirm | (none) | “Leave group?” / outstanding balances stay / Cancel or Leave group |
| This device | Token live, bind live, lobby lists the group | Bind soft-deleted, token revoked, lobby omits the group |
| Other devices | Unchanged | Bind gone; member and expenses still there |

## Plan

1. Pure `L-tombstoneBind` (`tombstoneBind` in `src/domain/bind.ts`): given a live bind and a timestamp, return the same id at `version + 1` with `deleted_at` set. Soft-delete only.
2. Worker route `leave-group` (add to `FUNCTIONS` / `ROUTES`): capability check, then set `revoked_at` on this device’s token in D1. Idempotent if already revoked. `?health=1` like the others. Clients still never talk to D1.
3. Order in `L-leaveGroup`: tombstone the live bind locally, flush it (`L-flushQueue`) **while the token still works**, then `leave-group`, then drop the token, drop the lobby id, close the wake socket, return to the lobby. If flush or revoke fails, stay on the member screen and surface the typed error; do not drop the lobby.
4. `L-member` shows **Leave group** only when this row is You. Confirm matches the prototype copy. Cancel does nothing.
5. Capture: new `F-leave` — from a spent group, open You, confirm leave, lobby no longer lists that group. Kick stays parked.

## Seams under test

| Seam | Behavior |
| --- | --- |
| `L-tombstoneBind` | Live bind → same id, version + 1, `deleted_at` set. Already-tombstoned bind is a no-op (null / unchanged — pick one and pin it). |
| `L-efLeave` / `L-edgeLeave` | Local Worker: a live token can `leave-group`; a later `merge` or `fetch-entity` with that token is rejected; health on the new route; already-revoked leave is still 200. |

## Acceptance

- On You-detail: **Leave group** → confirm → lobby, group gone from the list. Other members’ rows have no Leave.
- After leave, that token cannot fetch the group. Member and expenses remain for anyone who still has access.
- Tests at the two seams above. `npm run check` green. `F-leave` clip.

## Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-member` | Other member (not You) | No Leave group. |
| `L-member` | Confirm Cancel | Confirm closes; still in the group. |
| `L-tombstoneBind` | Already tombstoned | Returns null (unit). |
| `L-efLeave` | Token already revoked | 200 `{ ok: true }` (contract). |
| `L-leaveGroup` | Flush or revoke fails | Stay on member; typed error; lobby not dropped. |

## Out of scope

- Kick out — parked
- Reopen **This is me** after expenses (orphaned slot) — parked (D-020)
- Wipe the local SQLite group store — lobby drop is enough
- Invite-to-rejoin chrome — parked

## Parked this session

- Kick out — core value (already parked)
- Reclaim a slot after leave-with-expenses — core value (D-020 / reopen binding)
