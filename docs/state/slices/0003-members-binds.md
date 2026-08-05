# Slice 0003 — members + binds / assumed member

**Tier** — core value · **Closed** — 2026-08-05 · **Commit** — `slice(0003): members + binds / assumed member`

## What shipped

Name-slot members and device↔member binds as merge entities. Hub: add member, This is me, You (Name). Create group stays empty. Open/foreground pulls roster via `list-roster`. One active bind per device per group (unique index + client hide). Same-group bind integrity (composite FK + merge check). Phone demo confirmed.

## Questions asked and answered

- Creator bind → empty create; Add → This is me (D-011)
- Peer roster catch-up → list members+binds on open/foreground (D-012)
- UI scope → list + add + bind + You label; rename/leave parked (D-013)
- Bind uniqueness → one active bind per device per group; multi-device same member allowed (D-014)

## What was parked during this slice

- Sync quality harden (deepen groupSync, typed errors, queue identity, sync tests) → following slice
- Soft-delete / rename / leave / rebind → PARKING
- Claimed-slot / invites → PARKING
- Full missed-wake → PARKING

## Notes

- Review blocker fixed before close: bind `member_id` must belong to same `group_id`.
- Early `list-roster` 404 left sticky `lastError`; cleared on successful roster pull.
