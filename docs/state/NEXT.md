# Slice 0041 — invite landing

**Tier** — breadth

## Goal

Opening `/j/{token}` on the public site shows a SplitNext invite page (landing chrome). A phone is pointed at the app; desktop continues to redeem.

## Before → After

| Aspect | Before | After |
| --- | --- | --- |
| `splitnext.online/j/{token}` | 404 or Expo `/app/j/…` if they hit `/app` | Static invite page using `landing/` chrome |
| Phone | No store/app CTA on the public host | CTA toward the app (stores parked) |
| Desktop | Must already be in `/app` | Continue to redeem at `/app/j/{token}` |

## Plan

1. Root `landing/404.html`: if the path is `/j/{token}`, render invite chrome; otherwise a normal not-found.
2. Phone: copy that points at installing/opening the app; do not link the v1 store listing.
3. Desktop: continue into `/app/j/{token}` (existing `L-join`).
4. Local `npm run landing` serves the same 404 fallback so `/j/…` can be tried.

## Seams under test

| Seam | Behavior |
| --- | --- |
| Invite path detect | `/j/{token}` is an invite; other unknown paths are not |
| Token extract | 11-char secret pulled from the path |

## Acceptance

- Desktop `/j/{token}` shows invite chrome and a continue control into `/app/j/{token}`.
- Phone-sized `/j/{token}` shows app-directed copy, not a store listing.
- `/no-such-page` is a generic 404, not invite chrome.
- Landing home and `/try` unchanged.

## Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| Invite page | missing/short token | Generic 404 |
| Invite page | desktop | Continue to `/app/j/{token}` |
| Invite page | narrow window | App CTA; stores stay parked |

## Out of scope

- Store listings
- Deep-link `.well-known` / Expo Go app links
- Legal
- Changing token format or redeem
