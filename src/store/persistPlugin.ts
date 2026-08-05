import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import type { ObservablePersistPlugin } from '@legendapp/state/sync';
import Storage from 'expo-sqlite/kv-store';

/**
 * Where a group's store survives a restart. Native uses SQLite; the web build
 * swaps in `persistPlugin.web.ts` — see the note there for why the platforms
 * differ, and what that means for what web can prove.
 */
export const persistPlugin: ObservablePersistPlugin =
  observablePersistSqlite(Storage);
