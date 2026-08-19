# Slice 0042 — legal

**Tier** — breadth

## Goal

Public privacy and terms pages that match what the app actually does, linked from the landing footer.

## Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Privacy / terms | None on the public site | Pages that describe no accounts, capability tokens, and what is stored |
| Footer | Brand name only | Links to those pages |
| Deletion | Not stated | Deletion-on-request, without a join-code wipe |

## Plan

1. Static privacy and terms under `landing/`, same chrome as `L-landing`.
2. Footer on home, invite/404, and try: Privacy, Terms.
3. Copy matches real behaviour: no accounts, per-device capability tokens, Worker/D1/DO what is stored, integer cents, soft-delete. Deletion-on-request without v1's join-code verified wipe.

## Seams under test

| Seam | Behavior |
| --- | --- |
| `L-assemblePages` | Privacy and terms files land at the Pages root; `/app` is unchanged |
| Footer links | Home, invite 404, and try point at those pages |

## Acceptance

- Landing footer opens privacy and terms.
- Copy does not claim accounts, payments, or a join-code wipe.
- Invite landing and `/try` still work.

## Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| Legal pages | (filled during the build) | |

## Out of scope

- Store listings
- Implementing a deletion pipeline (copy only)
- Deep-link `.well-known`
- Changing invite redeem
