# Slice 0038 — push notifications

**Tier** — foundation-risk

## Now → After

| Aspect | Before | After |
| --- | --- | --- |
| Awareness off-hub | Nothing | Expo push when sync would toast (foreign activity) |
| Device tokens | None | Register with Worker; stored per device + group |
| Worker | Activity merge only | Push non-actors on accepted activities |

## Plan

1. **Client** — register Expo push token on hub open; send to Worker with group + device id.
2. **Worker** — D1 `device_push_tokens` table; register/revoke routes; on activity merge accept, fan out to other devices in group (exclude actor's device).
3. **Payload** — title/body from `formatActivityLine` shape; tap opens group hub.
4. **Web** — skip registration (no push on web target).

## Acceptance

- Device A on hub; device B adds expense → A gets push when backgrounded.
- Actor does not get push for own activity.
- `npm run check` green; Worker routes in verify_deploy.

## Seams under test

- Push recipient selection (exclude actor device) — vitest
- Token register route — edge.test / worker test

## Out of scope

- Undo, per-group mute, invite landing, legal
- Push for non-activity events

## Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| No Expo token | simulator / denied | Register skipped; app works. |
| Web target | browser | No push registration. |
| Leave group | token revoked | Worker drops tokens for that group+device. |

## Parked this session

- Undo, invite landing, legal, pending badge, per-group mute
