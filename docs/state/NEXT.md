# Slice 0006 — web target

**Tier** — foundation-risk

## Goal

Run the whole app in a browser, so a change can be driven end to end without a phone in hand. Two native-only dependencies stand in the way; each gets a seam with a web implementation rather than a `Platform.OS` branch scattered through callers. This is what makes headless runs and board screenshots possible at all.

## Before → After

| | Now | After |
| --- | --- | --- |
| Web | `npm run web` bundles, then throws on the first screen that touches secrets | The whole app runs; create → add member → This is me → add expense works in a browser |
| Secrets | `expo-secure-store` imported directly by `L-accessToken`, `L-lobbyIds`, `L-deviceUser` | All three go through `L-secureStorage`; the native module is never imported on web |
| Durability | `L-getGroupStore` persists via `expo-sqlite` on every platform | `L-persistPlugin` picks per platform — SQLite on device, `localStorage` on web |
| Testing | Phone only, by hand | A browser can drive the real flows against the real Edge Functions |
| Board evidence | Prose only | Screenshots in `docs/state/shots/`, rendered on the slice page |

## Plan

1. `L-secureStorage` — `getSecret` / `setSecret` behind one small interface, with a `.web.ts` twin on `localStorage`. Point `L-accessToken`, `L-lobbyIds` and `L-deviceUser` at it.
2. `L-persistPlugin` — lift the plugin out of `persist.ts` so the platform split is one file, not a branch inside the configure logic.
3. Prove the app runs: bundle, then drive the real flows in a headless browser and read the console.
4. Teach the board to render `### Edge paths` and `### Shots`, so the self-review and the screenshots have somewhere to land.

## Seams under test

| Seam | Behavior |
| --- | --- |
| `L-secureStorage` | The only place the keychain is named; a fake here replaces secrets wholesale |
| `L-persistPlugin` | The only place durability is chosen; swapping it cannot reach the callers |

## Acceptance

- `npm run web` serves the app; create group → add member → This is me → add expense completes with an empty console.
- State survives a fresh page: the lobby lists the group and the hub still shows You (Name).
- Native is untouched — typecheck and the full suite stay green, and no caller imports `expo-secure-store` or `expo-sqlite` directly any more.

## Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-secureStorage` | web, static prerender with no `window` | Falls back to an in-memory map rather than throwing during the export render. |
| `L-secureStorage` | web, cookies blocked | `localStorage` throws on access rather than returning null; caught, falls back to memory. |
| `L-persistPlugin` | web, headless browser | `localStorage`, so no wasm and no OPFS — the reason the documented sqlite web path was abandoned. |
| `L-getGroupStore` | web, second page load | Store rehydrates from `localStorage`; verified by reloading onto the hub and seeing You (Name) survive. |

## Out of scope

- Committing a browser test harness — the run was ad hoc; making it a suite is its own slice, parked
- Deploying the web build anywhere
- `expo-sqlite` on web via wasm — attempted and abandoned; see the note in `persistPlugin.web.ts`
- Responsive or desktop layout; web renders the phone layout as-is

## Parked this session

- **Browser-driven flow tests** — now possible for the first time — foundation-risk
