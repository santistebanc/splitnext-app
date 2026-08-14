# Slice 0025 — leave group

**Tier** — core-value · **Closed** — 2026-08-14 · **Tag** — `slice-0025`

## What shipped

On You-detail, **Leave group** (after a confirm) unbinds this device and revokes its access token. The member slot and expenses stay. The group drops off this device’s lobby. D-020 is unchanged.

## Report

### Headline
You can leave a group from this device without erasing the person or the ledger.

### Highlights
- **Leave on You** — confirm, then lobby; other members have no Leave.
- **Unbind then revoke** — soft-delete the bind and flush it while the token still works, then `leave-group` (D-075).
- **Idempotent revoke** — already-revoked is still 200; the Durable Object is not touched.
- **Failed leave stays** — leftover flush or revoke fail set `leave_failed`; Leave stays on this screen, lobby not dropped.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| You-detail | Net, buckets, settle | Same, plus **Leave group** (danger) |
| Confirm | (none) | Outstanding balances stay; Cancel or Leave group |
| This device | Token live, bind live, lobby lists the group | Bind soft-deleted, token revoked, lobby omits the group |
| Other devices | Unchanged | Bind gone; member and expenses still there |

### Surfaces touched

- **Client** — `L-member` Leave + confirm; `L-leaveGroup`; `L-tombstoneBind`; `L-accessToken` / `L-lobbyIds` delete; `L-wakeSub` stop without retry
- **Server** — `L-efLeave` / `leave-group`; `revokeAccessToken`; `accessIdentifies`
- **State** — `OVERVIEW.md`, `LOGIC.md`, `FLOWS.md`, this archive, `DECISIONS.md` (D-075), `PARKING.md`
- **Capture** — `F-leave`; stills `0025-hub.png` / `0025-you.png` / `0025-leave-confirm.png`; `F-bump` re-recorded after FLOWS insert

### Decisions this slice

- D-075 — Leave unbinds this device (soft-delete the bind, flushed while the token still works) then revokes its access token. The member slot and expenses remain. D-020 is unchanged.

### Logic delta

- **Added** — `L-tombstoneBind` · `L-leaveGroup` · `L-edgeLeave` · `L-efLeave`
- **Changed** — `L-member` (Leave on You) · `L-accessToken` (`deleteAccessToken`) · `L-lobbyIds` (`removeLobbyGroupId`) · `L-wakeSub` (`stopWakeSubscription`) · `L-secureStorage` (`deleteSecret`) · `L-syncError` (`leave_failed`)

### Flow delta

- **Added** — `F-leave`
- **Changed** — `F-bump` (clip re-recorded after FLOWS insert)

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-member` | Other member (not You) | No Leave group. |
| `L-member` | Confirm Cancel | Confirm closes; still in the group. |
| `L-tombstoneBind` | Already tombstoned | Returns null (unit). |
| `L-efLeave` | Token already revoked | 200 `{ ok: true }` (contract). |
| `L-leaveGroup` | Flush leftover | Stay on member; `leave_failed`; lobby not dropped; Leave stays on this screen. |
| `L-leaveGroup` | Revoke fails | Stay on member; `leave_failed`; lobby not dropped; Leave stays on this screen. |
| `L-member` | Group name empty | Confirm says “this group”. |

### Review

- **Invariants** — Soft-delete bind by version; token `revoked_at` not DELETE; client only hits the Worker; D-075 appends rather than silently reversing D-013; D-020 untouched.
- **Spec** — Seams under test covered; `F-leave` clip exists; kick / reopen This is me / SQLite wipe / rejoin chrome kept out. Accepted: no extra “another device can still fetch member/expenses” contract — `handleLeave` never touches the Durable Object. Extra vs “Leave only on You”: `showLeave = isYou \|\| lastError?.code === 'leave_failed'` leaked Leave onto every member after a failed leave. Fixed: `offerLeave` is local to this screen. Flush leftover after a successful HTTP merge could clear `lastError` then `return false` with no retry. Fixed: leftover sets `leave_failed`.
- **Standards** — `handleLeave` skipped `accessAllows` so already-revoked is 200. Extracted `accessIdentifies` (group + device, ignore revoke); `accessAllows` uses it plus live. Accepted: leave UI lives on the member screen; queue-append shape matches `bindMe`.

### Shots

- `0025-hub.png` — balance-list hub after a spent group
- `0025-you.png` — You-detail with Leave group
- `0025-leave-confirm.png` — confirm copy
- Recorded `flows/F-leave.webm` · re-recorded `flows/F-bump.webm`

### Diff pulse

`+585 / −24 · 29 files` — from `git diff main --stat` at close

## Questions asked and answered

- **Leave after expenses, or only while binding is open?** → Leave even after expenses (D-020 unchanged; slot stays).
- **Kick in the same slice?** → No; parked.
- **Build it?** → Yes.
- **Close it?** → Yes.

## What was parked during this slice

- Kick out → PARKING
- Reclaim a slot after leave-with-expenses → PARKING (D-020 / reopen binding)
- Wipe the local SQLite group store → out of scope (lobby drop is enough)
- Invite-to-rejoin chrome → PARKING

## Notes

Capture used `--url http://127.0.0.1:8082` because 8081 was already taken. First `F-leave` hit 405 until the slice branch deployed `leave-group`.
