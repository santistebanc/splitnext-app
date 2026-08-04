import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import { configureObservableSync } from '@legendapp/state/sync';
import Storage from 'expo-sqlite/kv-store';

const persistPlugin = observablePersistSqlite(Storage);
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
