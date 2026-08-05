import { vi } from 'vitest';
import { currentServer } from './current';

/**
 * Everything a flow test must not really do: touch a device, a database, or a
 * socket. Registered once via vitest `setupFiles`, so a flow test file reads as
 * the flow and nothing else.
 */

let uuidCounter = 0;
vi.mock('expo-crypto', () => ({
  randomUUID: () => `id-${++uuidCounter}`,
}));

const secureStore = new Map<string, string>();
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => secureStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void secureStore.set(k, v),
  deleteItemAsync: async (k: string) => void secureStore.delete(k),
}));

// Legend's SQLite persistence is a device concern; the store itself is not.
vi.mock('@/src/store/persist', () => ({
  getPersistPlugin: () => undefined,
  ensurePersistConfigured: () => {},
}));
vi.mock('@legendapp/state/sync', () => ({
  syncObservable: () => {},
  configureObservableSync: () => {},
}));

vi.mock('@/src/config/env', () => ({
  env: { supabaseUrl: 'http://fake', supabaseAnonKey: 'anon' },
}));

// Realtime: subscribing registers a listener on the fake server.
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    realtime: { setAuth: () => {} },
    channel: (name: string) => {
      const handlers: ((msg: { payload: unknown }) => void)[] = [];
      return {
        on(_event: string, _filter: unknown, cb: (msg: { payload: unknown }) => void) {
          handlers.push(cb);
          return this;
        },
        subscribe() {
          currentServer().subscribe(name, (payload) =>
            handlers.forEach((h) => h({ payload })),
          );
          return this;
        },
      };
    },
  }),
}));

// The one wire boundary: every call goes to the fake server instead of HTTP.
vi.mock('@/src/api/edge', () => ({
  createGroupRemote: async (i: Parameters<ReturnType<typeof currentServer>['createGroup']>[0]) =>
    currentServer().createGroup(i),
  mergeEntities: async (i: Parameters<ReturnType<typeof currentServer>['merge']>[0]) =>
    currentServer().merge(i),
  fetchEntity: async (i: Parameters<ReturnType<typeof currentServer>['fetchEntity']>[0]) =>
    currentServer().fetchEntity(i),
  listRoster: async (i: Parameters<ReturnType<typeof currentServer>['listRoster']>[0]) =>
    currentServer().listRoster(i),
  mintRealtimeAuth: async (
    i: Parameters<ReturnType<typeof currentServer>['mintRealtimeAuth']>[0],
  ) => currentServer().mintRealtimeAuth(i),
}));

export { secureStore };
