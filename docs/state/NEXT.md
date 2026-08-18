# Slice 0037 — last opened group on launch

**Tier** — core value

## Now → After

| Aspect | Before | After |
| --- | --- | --- |
| Cold start | Lobby list always | If a last-opened group id is stored and still on the lobby, navigate straight to that hub |
| Lobby | Unchanged | Still reachable via home; list unchanged |

## Plan

1. **Persist** — remember `lastOpenedGroupId` when a hub mounts (or when navigating to `/group/[id]`).
2. **Lobby** — on first paint, if stored id is in `listLobbyGroupIds`, `router.replace` to that hub once.
3. **Edge** — left/removed group clears or ignores stale id; no token → stay on lobby.

## Acceptance

- Open group A → kill app → relaunch → lands on group A hub (not lobby).
- Leave group or remove from lobby → relaunch → lobby.
- `npm run check` green.

## Seams under test

- Pure resolver: stored id + lobby ids → destination — vitest
- Lobby redirect once — component test or capture step if trivial

## Out of scope

- Push, undo, invite landing, legal
- Deep links / invite URLs
- Changing lobby list UI

## Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| Last id not in lobby | stale after leave | Stay on lobby; optionally clear stored id. |
| Empty lobby | no groups | Lobby as today. |
| Multiple tabs / web refresh | — | Same rule: one redirect on lobby mount. |

## Parked this session

- Push notifications, undo, invite landing, legal, pending badge
