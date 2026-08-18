# Slice 0039 — production landing + framed web

**Tier** — breadth · **Closed** — 2026-08-18 · **Tag** — `slice-0039`

## What shipped

Public Pages is a product landing. **Use on web** embeds `/app` in a phone frame. The Expo app is full-bleed. The slicer board is local-only.

## Report

### Headline
Open the site → landing → Use on web → live app in a bezel; `/app` and capture stay full-bleed.

### Highlights
- **`L-landing` / `L-tryWeb` / `L-serveLanding`** — static `landing/`; locally `npm run landing` frames Metro.
- **`L-assemblePages`** — Pages tree never includes `slicer.html` or `docs/state`.
- **App** — phone frame removed from `+html.tsx`.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Pages `/` | Slicer board | Landing |
| Phone frame | Inside Expo web | `/try` iframe only |
| Manual web | `npm run web` full-bleed | `npm run landing` framed `/try` (D-094) |

### Surfaces touched

- **Client** — `app/+html.tsx` · `InFrameOverlay` · deleted `phoneFrame.ts`
- **Public site** — `landing/` · `assemble_pages.py` · `pages.yml`
- **State** — `OVERVIEW.md`, `LOGIC.md`, `DECISIONS.md` (D-093, D-094), `PARKING.md`, this archive

### Logic delta

- **Added** — `L-landing` · `L-tryWeb` · `L-assemblePages` · `L-serveLanding`
- **Removed** — `L-webFrame`
- **Changed** — Pages assemble; overlay-root still used for drawers

### Flow delta

- No new capture clip (landing is not the Expo web target).

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-tryWeb` | window width &lt; 480 | Redirect to `/app`. |
| `L-tryWeb` | desktop | Live iframe of `/app` in a 420×900 bezel, scaled to fit. |
| Capture | 420×900 viewport | Full-bleed app (no bezel). |
| `L-serveLanding` | Metro not up yet | Landing serves; iframe fills when Expo answers. |
| `L-serveLanding` | 8081 already serving | Reuses it; does not start a second Expo. |

### Review

- **Invariants** — Worker/sync/money/capability door unchanged. Pages still same-origin `/app` (D-031 narrowed, not reversed).
- **Spec** — Production `/` is the landing; board is local-only; phone bezel is `/try` only. Invite landing, legal, and store buttons stayed parked.
- **Standards** — `assemble` is the seam (`assemble_pages_test` plus a Pages workflow assertion that CI never runs `generate-slicer-board.py`). `inject_app_origin` is the local-frame seam (D-094). Phone-scale CSS lives once, on `/try`. Overlay host is `#overlay-root` with `position: fixed` now that there is no in-app bezel.

### Shots

- Landing uses committed `landing/preview.png` (hub still).

## What was parked during this slice

- Invite `/j/{token}` landing, legal, store listings, undo, `/pr/N/` remaining on Pages for CI comments

## Notes

D-093 reverses D-084's marketing-site exclusion for this landing only.
