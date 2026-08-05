# Slice 0006 — web target

**Tier** — foundation-risk · **Closed** — 2026-08-05 · **Tag** — `slice-0006`

## What shipped

`npm run web` runs the whole app in a browser. Two native-only dependencies now sit behind seams with web implementations, so the same code path works on a phone and in headless Chromium — which is what makes end-to-end runs and board screenshots possible for the first time.

## Report

### Headline
The app runs in a browser, so a change can be driven end to end without a phone — at the cost of two platform splits that web alone cannot test.

### Highlights
- `L-secureStorage` is the only place the keychain is named; `L-accessToken`, `L-lobbyIds` and `L-deviceUser` all go through it and no longer import `expo-secure-store`.
- `L-persistPlugin` is the only place durability is chosen, so swapping SQLite for `localStorage` on web cannot reach a caller.
- Metro resolves `.web.ts` by extension, so neither native module enters the web bundle at all — no `Platform.OS` branch anywhere.
- The documented `expo-sqlite`-on-web path was tried in full and abandoned: wasm over OPFS needs `createSyncAccessHandle`, which headless Chromium does not implement, so every store write hung on "Sync operation timeout". The metro wasm config and COEP/COOP headers were reverted rather than left behind as config that no longer does anything.
- The board renders `### Edge paths` and `### Shots`, so the self-review and the screenshots have somewhere to land instead of living only in a transcript.

### Before → After

| Aspect | Before | After |
| --- | --- | --- |
| Web | Bundled, then threw on the first screen touching secrets | Whole app runs; create → member → This is me → expense works in a browser |
| Secrets | `expo-secure-store` imported by three callers directly | One seam, `L-secureStorage`, with a `localStorage` twin |
| Durability | `expo-sqlite` on every platform | `L-persistPlugin` picks per platform |
| Testing | Phone only, by hand | A headless browser drives the real flows against the real Edge Functions |
| Board evidence | Prose only | Screenshots and an edge-path table on the slice page |

### Logic delta

- **Added** — `L-secureStorage` (the one door to the device's secrets) · `L-persistPlugin` (where a store survives a restart)
- **Changed** — `L-deviceUser`, `L-accessToken`, `L-lobbyIds` (they now name a secret store rather than Secure Store)

### Flow delta

- Unchanged. No flow gained or lost a step; the seams sit underneath the steps that already existed.

### Edge paths

| Surface | State | What happens |
| --- | --- | --- |
| `L-secureStorage` | web, static prerender with no `window` | Falls back to an in-memory map rather than throwing during the export render — the static route export was the thing that caught this. |
| `L-secureStorage` | web, cookies blocked | `localStorage` throws on access rather than returning null; caught, falls back to memory. |
| `L-persistPlugin` | web, headless browser | `localStorage`, so no wasm and no OPFS. |
| `L-getGroupStore` | web, second page load | Rehydrates from `localStorage`; verified by reloading onto the hub and seeing You (Name) survive. |
| `L-getGroupStore` | web, sqlite wasm path (abandoned) | Cross-origin isolation and `SharedArrayBuffer` both worked; `createSyncAccessHandle` was undefined, so writes hung rather than failing loudly. |

### Shots

- `0005-choose-open.png` — Three members, none claimed: every row offers **This is me**, the rule slice 0005 introduced.
- `0005-choose-closed.png` — After the first expense: no row offers it, and the expense is listed against the payer.

### Surfaces touched

- **Client** — `src/secrets/secureStorage.ts` + `.web.ts`, `src/store/persistPlugin.ts` + `.web.ts`, `src/store/persist.ts`, `src/secrets/tokens.ts`, `src/device/deviceUser.ts`
- **Server** — none
- **State** — `OVERVIEW.md`, `LOGIC.md`, `PARKING.md`, `docs/state/shots/`, `docs/scripts/generate-slicer-board.py`

### Decisions this slice

- D-022 — Web uses `localStorage` for both secrets and durability rather than the wasm sqlite path
- D-023 — Platform splits use `.web.ts` file resolution, never a `Platform.OS` branch in a caller

### Diff pulse

`+275 / −16 · 11 files` — from `git show --stat` at close

## Questions asked and answered

- **Does the documented expo-sqlite web setup work?** → No, not headless. Cross-origin isolation and `SharedArrayBuffer` were fine; `createSyncAccessHandle` is missing in headless Chromium, which is exactly the environment this slice exists to serve.
- **Keep the metro wasm config and COEP/COOP headers anyway?** → No. Nothing uses them once web is off sqlite, and config that does nothing is a lie about how the app works.
- **Should this ride in slice 0005?** → No. It is tooling, not the expense spine; it became its own slice so each commit means one thing.

## What was parked during this slice

- Browser-driven flow tests → PARKING (foundation-risk)

## Notes

**Web does not exercise the real persistence adapter.** A bug living in the SQLite plugin will not show up in a browser run, and neither will anything that turns on keychain behaviour. Both remain phone questions. The comment at the top of `persistPlugin.web.ts` says so, because the next person to trust a green browser run needs to read it there, not here.

The secrets fallback is `localStorage`, which any script on the origin can read. That is acceptable for what this app keeps — a device id and per-group capability tokens, each revocable server-side — and for what the web target is for. A credential with wider blast radius would need the platforms split apart first.

The screenshots in this slice show slice 0005's binding rule. They belong to this slice's report because this slice is what made capturing them possible; 0005 closed with none.
