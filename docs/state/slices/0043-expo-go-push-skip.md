# Slice 0043 — Expo Go skip push import

**Tier** — foundation-risk · **Closed** — 2026-08-19 · **Tag** — `slice-0043`

## What shipped

Expo Go on Android can open a group without crashing. `expo-notifications` is imported only in a development or store build.

## Report

### Headline
Expo Go skips the push module; a development build still registers.

### Highlights
- **`L-notificationsAvailable`** — false when `appOwnership` is `expo`. Not `executionEnvironment` (`storeClient` also covers expo-dev-client).
- **`L-registerPushToken` / `L-usePushNotificationOpen`** — return early; dynamic-import `expo-notifications` only when available.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Expo Go Android | Importing `expo-notifications` throws (SDK 53+) | Never import it in Expo Go |
| Dev / store build | Registers on hub open | Unchanged |
| Web | Already a no-op (`.web.ts`) | Unchanged |

### Surfaces touched

- **Client** — `L-notificationsAvailable` · `L-registerPushToken` · `L-usePushNotificationOpen` · `L-openGroup`
- **State** — `OVERVIEW.md`, `LOGIC.md`, `DECISIONS.md` (D-098), `PARKING.md`, this archive

### Decisions this slice

- D-098 — Expo Go does not import `expo-notifications`; development and store builds still register. Narrows D-092.

### Logic delta

- **Added** — `L-notificationsAvailable`
- **Changed** — `L-registerPushToken` · `L-usePushNotificationOpen` · `L-openGroup`

### Flow delta

- No new capture clip (Expo Go crash is native-only; web already no-ops).

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-notificationsAvailable` | `appOwnership === 'expo'` | false |
| `L-registerPushToken` | Expo Go | return; never load `expo-notifications` |
| `L-usePushNotificationOpen` | Expo Go | no listener |

### Review

- **Invariants** — D-092 said native registers on hub open; Expo Go is native. D-098 records the narrowing (Expo Go skip; development/store still register; web still `.web.ts`). Money, version merge, soft-delete, and the Worker door are untouched.
- **Spec** — Matches NEXT.md: the listed seam is tested; callers dynamic-import only when available; mute, pending badge, store listings, hub descenders, and hub-as-shell stayed out (descenders recorded in PARKING).
- **Standards** — Pure one-argument seam; jobs stay wiring. Duplicate call-then-import at two sites is the plan, not a shared loader.

### Shots

- No new capture clip (Expo Go crash is native-only; web already no-ops).

## What was parked during this slice

- Per-group mute
- Pending badge
- Store listings
- Hub name descenders (`g`/`y` clip)
- Hub-as-shell

## Notes

`executionEnvironment === 'storeClient'` is Expo Go *and* a development build, so it cannot be the gate.
