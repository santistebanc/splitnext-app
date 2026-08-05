# Slice 0003 — members + binds / assumed member

**Tier** — core value · **Closed** — 2026-08-05 · **Commit** — `fd80dd0` · `slice(0003): members + binds / assumed member`

## What shipped

Name-slot members and device↔member binds as merge entities. Hub: add member, This is me, You (Name). Create group stays empty. Open/foreground pulls roster via `list-roster`. One active bind per device per group (unique index + client hide). Same-group bind integrity (composite FK + merge check). Phone demo confirmed.

## Report

### Headline
Devices can add name-slot members, bind as an assumed member, and pull the roster on open — the membership spine is live.

### Highlights
- Hub: Add member → This is me → **You (Name)**
- `members` + `binds` tables (deny-all RLS) and merge/fetch support
- `list-roster` Edge Function; open/foreground pulls the full roster
- One active bind per device per group (unique index + UI hide)
- Same-group bind integrity (composite FK + merge `member_not_in_group`)
- Assumed-member seam covered by vitest

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Members | none | Merge entities; hub list + add |
| Assumed member | none | Bind via This is me; You (Name) |
| Sync pull | group row only | + list members/binds on open/foreground |
| Create group | empty | still empty (no auto-member) |

### Logic delta

- **Added** — `L-addMember` · `L-bindMe` · `L-assumedMember` · `L-deviceHasBind` · `L-pullRoster` · `L-edgeRoster` · `L-efRoster`
- **Changed** — `L-hub` (members UI) · `L-syncGroup` (roster after fetch) · `L-efMerge` / `L-efFetch` (members + binds) · `L-getGroupStore` (members/binds maps)

### Flow delta

- **Added** — `F-add-member` · `F-bind`
- **Changed** — `F-sync` (step 4 pull roster) · `F-open` (step 3 inherits roster catch-up)

### Surfaces touched

- **Client** — hub members UI; `groupSync` add/bind/roster; `assumedMember` seam; store `members`/`binds`
- **Server** — migrations `members`/`binds`; `merge` + `fetch-entity` extended; new `list-roster`
- **State** — OVERVIEW capabilities/model; D-011…D-015; parking groom

### Decisions this slice

- D-011 — Empty create; Add → This is me
- D-012 — list-roster on open/foreground
- D-013 — Hub UI: list + add + bind + You (Name)
- D-014 — One active bind per device per group
- D-015 — Bind member must be same group

### Diff pulse

`+848 / −206 · 20 files`

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
