# Slice 0002 — queue auto-flush + reconnect catch-up

**Tier** — foundation-risk · **Closed** — 2026-08-05 · **Commit** — `slice(0002): queue auto-flush + reconnect catch-up`

## What shipped

Outbound queue flushes and a thin inbound group fetch run on group open and on app foreground for every lobby group. Offline bumps survive kill and upload when the app returns online without another bump tap. Per-group work is serialized so bump and foreground sync cannot race the queue.

## Questions asked and answered

- Reconnect scope → open + foreground; flush + one fetch (D-009)
- Which groups on foreground → all lobby group ids (D-010)

## What was parked during this slice

- Full missed-wake protocol → PARKING
- Realtime JWT signing → PARKING
- Lobby ids out of Secure Store → PARKING

## Notes

- `syncGroup` = `flushQueueInner` + `applyRemoteFetch('groups', id)` under `runExclusive`.
- `useLobbyForegroundSync` in root layout; first sync on mount, then on AppState `active`.
- Review fix: exclusive chain covers both `flushQueue` and `syncGroup` (not only syncGroup dedupe).
