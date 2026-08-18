# Slice 0038 — push notifications

**Tier** — foundation-risk · **Closed** — 2026-08-18 · **Tag** — `slice-0038`

## What shipped

Expo push when foreign activity merges: device registers token on hub open; Worker fans out to non-actor devices after accepted activity merge.

## Report

### Headline
Open hub on phone → register push token → another member records activity → push arrives with activity line text.

### Highlights
- **`L-registerPushToken`** — native Expo token registration on `L-openGroup`; web no-op.
- **`L-revokePushToken`** — on leave and via Worker route.
- **Worker** — D1 `device_push_tokens`; `register-push-token` / `revoke-push-token`; fan-out after activity merge via `L-pushRecipients` + `L-activityPushMessage`.
- **Tap** — notification opens group hub (`L-usePushNotificationOpen`).

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Off-hub awareness | Wake only (if socket open) | Push on foreign activity |
| Device tokens | None | Stored in D1 per group+device |

### Surfaces touched

- **Client** — `L-registerPushToken` · `L-revokePushToken` · `L-usePushNotificationOpen` · `L-openGroup` · `L-leaveGroup` · `L-formatActivityLinePlain`
- **Server** — D1 migration · push routes · merge fan-out · Expo Push API
- **State** — `OVERVIEW.md`, `LOGIC.md`, `DECISIONS.md` (D-092), `PARKING.md`, `verify_deploy.py`, this archive

### Logic delta

- **Added** — `L-pushRecipients` · `L-activityPushMessage` · `L-expoPush` · `L-registerPushToken` · `L-revokePushToken` · `L-usePushNotificationOpen` · `L-formatActivityLinePlain`
- **Changed** — `L-openGroup` · `L-leaveGroup` · Worker merge handler

### Flow delta

- No new capture clip; push needs physical device + Expo credentials.

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| Web | browser | No registration. |
| Permission denied | native | Registration skipped. |
| No `EXPO_ACCESS_TOKEN` on Worker | dev/CI | Fan-out no-op; merge still succeeds. |
| Actor device / same member bind | merge | Excluded from recipients. |

### Review

- **Invariants** — Merge/auth unchanged; push is side effect via `waitUntil`.
- **Spec** — Non-actors only; web skipped; leave revokes.
- **Standards** — Pure recipient selection vitest; routes on verify list.

### Shots

- No new flow clip.

## What was parked during this slice

- Per-group mute, undo, invite landing, legal, pending badge

## Notes

Requires `EXPO_ACCESS_TOKEN` on the Worker for real delivery; registration and fan-out logic run without it.
