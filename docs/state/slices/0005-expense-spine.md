# Slice 0005 — expense spine

**Tier** — core value · **Closed** — 2026-08-05 · **Tag** — `slice-0005`

## What shipped

A cost can be recorded against the member who paid it, in whole cents, and it survives the round trip to the server and back. Choosing which member you are stays open — on every member, changeable — until that first expense fixes it.

## Report

### Headline
Expenses become a real synced entity, and the first one is what closes this device's choice of who it is.

### Highlights
- `addExpense` writes locally at version 1 and flushes through the same `merge` path as members and binds — no second write path for money.
- Money is integer cents everywhere; the hub parses `12,34` and `12.34` alike and refuses anything that is not a positive whole number of cents.
- `sortByFlushOrder` puts expenses after members, so a payer always exists on the server before the expense naming them.
- Binding is now gated on the *group*, not the device: every member offers **This is me** until the first live expense, and the claim can be moved freely before then.
- Re-choosing re-points this device's existing bind at the next version instead of creating a second live one.
- The fake edge server added mid-slice was removed again (+218 then −1144): it cost more than it paid while the shape of the app is still moving.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Ledger | Nothing to record | Add expense: payer, amount, description |
| Entities synced | `groups`, `members`, `binds` | + `expenses`, through the same `L-edgeMerge` path |
| Money | Not represented | Integer cents; no floats anywhere |
| Hub | Members list | Members list + expenses list, newest first |
| Choosing who you are | One shot — the button vanished for good once this device bound | Open until the group's first expense; every member offers it and the claim can move |
| Server | Three tables | + `expenses`, deny-all RLS, same version rule |
| Test harness | Flow tests over a fake edge server | Seam-level vitest only; the fake was removed |

### Logic delta

- **Added** — `L-addExpense` (records a cost against the paying member) · `L-bindingOpen` (whether this device may still choose)
- **Changed** — `L-bindMe` (gate moved from "device already bound" to "group has an expense"; re-binding moves the existing bind) · `L-hub` (expenses list, add-expense form, per-row button rule) · `L-sortByFlushOrder` (expenses order after members) · `L-syncError` (`already_bound` → `binding_closed`)
- **Removed** — `L-deviceHasBind` (`deviceHasActiveBind` had no callers once the gate moved)

### Flow delta

- **Added** — `F-add-expense`
- **Changed** — `F-bind` (steps 1, 3, 4 — the button now shows on every unclaimed member while binding is open, and a second tap re-points the existing bind rather than being refused)

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-hub` | group has no members yet | The list says "No members yet — add yourself first"; no button to offer. |
| `L-hub` | this device has not bound | Every member offers **This is me**; the expense form is hidden and the hint says to tap it first. |
| `L-hub` | bound, still no expenses | The claimed row reads You (Name) with no button; every other member still offers one, so the choice can be moved. |
| `L-hub` | first expense exists | No member offers the button, including unclaimed ones. |
| `L-bindMe` | tapped after an expense exists | Refuses with `binding_closed` and writes nothing — the UI has already hidden the button, so this is the rule, not the message. |
| `L-bindMe` | tapped on the member already claimed | Returns without queueing anything; no wasted version bump, no wake for a no-op. |
| `L-bindMe` | re-bound before any expense | The existing bind is re-pointed at the new member at version + 1; the server accepts the higher version. Verified through a full `L-pullRoster` round trip. |
| `L-bindMe` | member deleted between render and tap | Refuses with `member_missing`. |
| `L-addExpense` | amount is a fraction of a cent, zero, or negative | Refused before anything is stored or queued. |
| `L-addExpense` | payer is not a member of this group | Refused locally, and `L-efMerge` rejects it server-side as `member_not_in_group`. |

### Shots

- Not captured — the screenshot mechanism and the web target that makes it possible both land in slice 0006. The first shots in the tree show this slice's binding rule but belong to that slice's report.

### Surfaces touched

- **Client** — `app/group/[id].tsx`, `src/domain/assumedMember.ts`, `src/sync/groupSync.ts`, `src/types/group.ts`, `src/types/syncError.ts`
- **Server** — `expenses` migration; `merge` / `fetch-entity` / `list-roster` widened to the new entity type
- **State** — `OVERVIEW.md`, `LOGIC.md`, `FLOWS.md`, `DECISIONS.md` (D-020, D-021), `PARKING.md`

### Decisions this slice

- D-020 — Binding stays open until the group's first live expense, then closes for good
- D-021 — One bind per device per group: re-binding re-points the existing bind, never adds a second

### Diff pulse

`+412 / −856 · 38 files` — from `git diff --stat slice-0004..HEAD` at close

## Questions asked and answered

- **Should the This is me button appear on the member already claimed?** → No. That row already reads You (Name); the button reads as "members you could switch to".
- **Does re-binding tombstone the old bind or move it?** → Move it. Two live binds would make `assumedMemberIdFromBinds` depend on iteration order (D-021).
- **Does the server need a change to accept a moved bind?** → No. `merge` upserts the bind row wholesale and re-checks `member_not_in_group`, so a higher version with a new `member_id` is accepted as-is.

## What was parked during this slice

- Flow tests and the fake edge server → PARKING (revisit when the surfaces settle)
- Reopening the binding choice after an expense exists → PARKING
- Hub component split → PARKING
- Lobby ids out of Secure Store → PARKING

## Notes

The expense entity models only who *paid*. Who owes is not represented at all yet — allocations arrive with balances, and every "split" word in the UI is still aspirational.

Acceptance was verified on a physical phone (kill/reopen, two devices) by the user; the automated checks in this repo cover the pure rules only.

The binding rule is deliberately a one-way door for now: nothing in the app reopens the choice once an expense exists. A later slice has to add that explicitly, and it should decide what happens to expenses already attributed to the old member.
