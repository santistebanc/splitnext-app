# Slice 0042 — legal

**Tier** — breadth · **Closed** — 2026-08-19 · **Tag** — `slice-0042`

## What shipped

Public privacy and terms pages that match what the app does, linked from the landing footer. Deletion is on request, without a join-code wipe.

## Report

### Headline
Landing footer → Privacy / Terms. Copy: no accounts, capability tokens, what is stored; ask GitHub to delete.

### Highlights
- **`L-privacy`** — `/privacy/`: no accounts, tokens, Worker/D1/DO, Expo push, GitHub Pages; deletion via GitHub issue, not a join code.
- **`L-terms`** — `/terms/`: records and suggests, never moves money.
- **Footer** — home, invite 404, and `/try` (bottom-right).

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Privacy / terms | None on the public site | Pages that describe no accounts, capability tokens, and what is stored |
| Footer | Brand name only | Links to those pages |
| Deletion | Not stated | Deletion-on-request, without a join-code wipe |

### Surfaces touched

- **Public site** — `landing/privacy/` · `landing/terms/` · footers on `L-landing` · `L-inviteLanding` · `L-tryWeb`
- **Local serve** — `static_page_for` for `/privacy` and `/terms`
- **State** — `OVERVIEW.md`, `LOGIC.md`, `DECISIONS.md` (D-097), `PARKING.md`, this archive

### Decisions this slice

- D-097 — Public `/privacy` and `/terms`; footer on landing, invite 404, and try; deletion-on-request via GitHub issue, no join-code wipe.

### Logic delta

- **Added** — `L-privacy` · `L-terms`
- **Changed** — `L-landing` · `L-tryWeb` · `L-inviteLanding` · `L-serveLanding` · `L-assemblePages`

### Flow delta

- No new capture clip (landing is not the Expo web target).

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-privacy` | deletion request | GitHub issue; no join-code verification |
| `L-privacy` / `L-terms` | from `/try` | Relative `../privacy/` and `../terms/` |
| `L-inviteLanding` | footer | Same links; Pages `base` keeps them on the site root |

### Review

- **Invariants** — Money, version merge, soft-delete, and the Worker door are untouched. D-093 and D-096 parked legal; D-097 records that it shipped. No deletion pipeline (copy only).
- **Spec** — Matches NEXT.md: privacy and terms on the public site, footer on home / invite / try, copy does not claim accounts, payments, or a join-code wipe. Store listings, `.well-known`, and invite redeem stayed out.
- **Standards** — Assemble and local serve are the seams (`assemble_pages_test`, `serve_landing_test`). Legal copy is static HTML next to the landing chrome. HTTP test fetches use a timeout so a missed path cannot hang the laptop gate.

### Shots

- No new capture clip (landing is not the Expo web target).

## What was parked during this slice

- Store listings
- Implementing a deletion pipeline
- Deep-link `.well-known`
- Retention as a separate policy beyond the privacy copy

## Notes

Deletion requests go to the public GitHub issues tracker. There is no in-app wipe.
