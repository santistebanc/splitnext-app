# Slice 0047 — member accordion on hub

**Tier** — polish · **Closed** — 2026-08-19 · **Tag** — `slice-0047`

## What shipped

Tapping a balance or roster name on the hub expands that member's detail on the hub. **Close** returns to the list. `/group/[id]/member/[memberId]` remains a URL wrapper.

## Report

### Headline
Member detail expands on the hub instead of pushing a stack page.

### Highlights
- **`L-memberDetail`** — extracted panel: name/edit in the panel, invite, buckets, settle, rename, kick; **Close** (`testID="member-close"`).
- **`L-hub`** — `memberOpenId` like `activityOpen`; mutually exclusive; FAB / all-expenses / balances hidden while open.
- **`L-member`** — thin URL wrapper around `L-memberDetail`; `headerShown: false`.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Balance / roster tap | `router.push` `/member/{id}` | Same hub; member panel expands |
| Close | Stack back | **Close** on the panel → hub |
| `/group/[id]/member/[memberId]` | Full page with stack header | URL wrapper; same `L-memberDetail` |

### Surfaces touched

- **Client** — `L-hub` · `L-memberDetail` · `L-member`
- **Capture** — `F-rename` · `F-kick-member` · `F-settle`
- **State** — `OVERVIEW.md`, `LOGIC.md`, `FLOWS.md`, `DECISIONS.md` (D-101), `PARKING.md`, this archive

### Decisions this slice

- D-101 — Member detail expands on the hub; Close returns. `/member/[memberId]` stays a URL. Narrows hub-as-shell member accordion and D-084 keep-surfaces for member from the hub.

### Logic delta

- **Added** — `L-memberDetail`
- **Changed** — `L-hub` · `L-member`

### Flow delta

- **Changed** — `F-rename` (expand on hub; Close not `goBack`) · `F-kick-member` (expand; Close after kick) · `F-settle` (expand from balance row) · `F-invite` (expand on hub)

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-hub` | member open | Balances / FAB / all-expenses / activity hidden |
| `L-hub` | activity then member | Member wins; activity closes |
| `L-member` route | URL | Same panel; Close → hub |

### Review

- **Invariants** — Money, merge, soft-delete, Worker door unchanged. Kick still tombstones; rename still patches version. D-100 hub-as-shell pattern extended to member without deleting the member route.
- **Spec** — Matches NEXT.md: expand not push, Close returns, `/member/[memberId]` kept, activity/member mutually exclusive. Settings / expense / lobby overlays stayed out.
- **Standards** — `MemberDetail` is the shared module; hub owns `memberOpenId`. Capture uses `member-close` instead of `goBack`.

### Shots

- Re-recorded `flows/F-rename.webm` · `flows/F-kick-member.webm` · `flows/F-settle.webm`

## What was parked during this slice

- Settings / expense / all-expenses / lobby as overlays
- Lobby-as-switcher
- Deleting `/group/[id]/member/[memberId]`

## Notes

Second hub-as-shell slice after 0046 activity expand.
