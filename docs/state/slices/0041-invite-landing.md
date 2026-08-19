# Slice 0041 — invite landing

**Tier** — breadth · **Closed** — 2026-08-19 · **Tag** — `slice-0041`

## What shipped

Opening `/j/{token}` on the public site shows a SplitNext invite page. A phone is pointed at the app (no store listing). Desktop continues to redeem at `/app/j/{token}`.

## Report

### Headline
Copied invite link → public `/j/{token}` chrome → Continue into the web app to join.

### Highlights
- **`L-inviteLanding`** — `landing/404.html`: invite chrome for a valid 11-char token; generic not-found otherwise.
- **`L-invitePath`** — `/j/{token}` (including Pages prefix) is an invite; Expo `/app/j/…` is not.
- **`L-inviteShare` / `joinPathForToken`** — copied web URLs hit the landing, not `/app`.
- **`L-serveLanding`** — local `npm run landing` serves the same 404 for `/j/…`.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Public `/j/{token}` | 404 or Expo `/app/j/…` | Static invite page using `landing/` chrome |
| Phone | No app CTA on the public host | App-directed copy; stores parked |
| Desktop | Must already be in `/app` | Continue to redeem at `/app/j/{token}` |

### Surfaces touched

- **Public site** — `landing/404.html` · `landing/styles.css` · `invite_landing.py` · `serve_landing.py`
- **Client** — `joinPathForToken`
- **State** — `OVERVIEW.md`, `LOGIC.md`, `FLOWS.md` (`F-invite`, `F-join`), `DECISIONS.md` (D-096), `PARKING.md`, this archive

### Decisions this slice

- D-096 — Pages `/j/{token}` is the static invite landing; share URLs drop `/app`; continue redeems at `/app/j/{token}`.

### Logic delta

- **Added** — `L-inviteLanding` · `L-invitePath`
- **Changed** — `L-parseInviteToken` · `L-inviteShare` · `L-serveLanding`

### Flow delta

- **Changed** — `F-invite` (copied URL is the public `/j/{token}`) · `F-join` (step 1: invite landing, then `L-join`)

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-inviteLanding` | missing/short token | Generic 404 |
| `L-inviteLanding` | desktop | Continue to `/app/j/{token}` (`L-join`) |
| `L-inviteLanding` | narrow window | App CTA; stores stay parked |

### Review

- **Invariants** — Money, version merge, soft-delete, and the Worker door are untouched. D-093 parked invite `/j/{token}`; D-096 records that it shipped and narrows D-080 so copied links are the site prefix, not `/app`.
- **Spec** — Matches NEXT.md: invite chrome on `/j/{token}`, generic 404 otherwise, phone copy with no store listing, desktop continue into `L-join`, home and `/try` unchanged. Token format and redeem unchanged. Accepted: a quiet **Continue in the browser** on a narrow window so a phone can still redeem while stores are parked.
- **Standards** — `invite_token_from_path` / `is_invite_landing_path` is the tested seam (`invite_landing_test`). Local serve and assemble pin that `/j/…` is landing 404 and `/app/404.html` stays Expo. Path detect is duplicated in `404.html` JS because GitHub Pages serves a static file; the Python module stays the source of truth.

### Shots

- No new capture clip (landing is not the Expo web target; `F-invite` / `F-join` stay unrecorded — second device).

## What was parked during this slice

- Store listings
- Deep-link `.well-known` / Expo Go app links
- Legal
- Hub as the only place (no in-app routes)

## Notes

D-096: Expo `/app/j/{token}` remains the join screen; the public copied link is the landing in front of it.
