import { configureObservableSync } from '@legendapp/state/sync';

import { persistPlugin } from './persistPlugin';

let configured = false;

export function getPersistPlugin() {
  return persistPlugin;
}

export function ensurePersistConfigured(): void {
  if (configured) return;
  configureObservableSync({
    persist: {
      plugin: persistPlugin,
      retrySync: true,
    },
  });
  configured = true;
}
