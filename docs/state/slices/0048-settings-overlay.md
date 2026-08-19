# Slice 0048 — settings overlay on hub

**Tier** — polish · **Closed** — 2026-08-19 · **Tag** — `slice-0048`

## What shipped

Tapping Settings on the hub expands group settings on the hub. **Close** discards; **Done** saves and returns. Leave still goes to the lobby. `/group/[id]/settings` remains a URL wrapper.

## Report

### Headline
Settings expands on the hub instead of pushing a stack page.

### Highlights
- **`L-settingsPanel`** — extracted panel: name/currency, Done, Leave, **Close** (`testID="settings-close"`).
- **`L-hub`** — `settingsOpen` mutually exclusive with activity/member; `paneOpen` hides FAB / all-expenses / balances.
- **`L-settings`** — thin URL wrapper; `headerShown: false`.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Settings gear | `router.push` `/settings` | Same hub; settings panel expands |
| Close | Stack back | **Close** on the panel → hub |
| Done | Save + `replace` hub | Save + close panel |
| `/group/[id]/settings` | Full page with header | URL wrapper; same `L-settingsPanel` |

### Surfaces touched

- **Client** — `L-hub` · `L-settingsPanel` · `L-settings` · `L-hubCorner`
- **Capture** — `F-bump` · `F-leave`
- **State** — `OVERVIEW.md`, `LOGIC.md`, `FLOWS.md`, `DECISIONS.md` (D-102), `PARKING.md`, this archive

### Decisions this slice

- D-102 — Settings expands on the hub; Close returns without saving; Done saves and closes. `/settings` stays a URL. Narrows hub-as-shell settings overlay.

### Logic delta

- **Added** — `L-settingsPanel`
- **Changed** — `L-hub` · `L-settings` · `L-hubCorner`

### Flow delta

- **Changed** — `F-bump` (expand on hub; assert title not URL) · `F-leave` (expand on hub)

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-hub` | settings open | Balances / FAB / activity / member hidden |
| `L-hub` | member then settings | Settings wins |
| `L-settings` route | URL | Same panel; Close → hub |
| `L-settingsPanel` | leave failed | Stays open; `leave_failed` |

### Review

- **Invariants** — Leave/rename/currency merge unchanged. D-091 Home → lobby unchanged.
- **Spec** — Matches NEXT.md. Expense / all-expenses / lobby overlays stayed out.
- **Standards** — `SettingsPanel` mirrors `MemberDetail`; hub owns `settingsOpen` and `paneOpen`.

### Shots

- Re-recorded `flows/F-bump.webm` · `flows/F-leave.webm`

## What was parked during this slice

- All-expenses / expense form / lobby overlays
- Lobby-as-switcher
- Deleting `/group/[id]/settings`

## Notes

Third hub-as-shell slice.
