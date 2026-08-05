import { ObservablePersistLocalStorage } from '@legendapp/state/persist-plugins/local-storage';
import type { ObservablePersistPlugin } from '@legendapp/state/sync';

/**
 * `expo-sqlite` does run on web, but only as wasm over OPFS, which needs a
 * cross-origin-isolated document *and* `createSyncAccessHandle` — and headless
 * Chromium does not implement the latter, so every store write hangs with
 * "Sync operation timeout". Expo also calls that path alpha.
 *
 * Web is the development, testing and screenshot target here, so it uses
 * `localStorage` instead: same interface, no wasm, works headless. The cost is
 * that **web does not exercise the real persistence adapter** — a bug that
 * lives in the SQLite plugin will not show up in a browser run. Anything that
 * turns on how persistence behaves has to be proven on a device.
 */
export const persistPlugin: ObservablePersistPlugin =
  new ObservablePersistLocalStorage();
