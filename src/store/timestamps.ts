import type { GroupStore } from '@/src/types/group';

/**
 * Undo the Dates that rehydration invents.
 *
 * Legend State's parser turns any exact ISO-8601 string back into a `Date`,
 * and does it before the reviver hook can object. Our entities carry
 * `updated_at` / `deleted_at` as strings — the shape the Worker sends
 * and the type the app declares — so a restored store would silently hold a
 * different type from a freshly synced one. Anything doing string work on it
 * breaks, and breaks late: sorting a list of one never calls the comparator,
 * so the crash waits for the second expense.
 *
 * Applied once when the store is opened, after persistence has loaded. It
 * returns the same object when there is nothing to fix, so a clean store is
 * never rewritten — and it repairs stores that were persisted before this
 * existed, which a change of persisted format could not.
 */
export function normalizePersistedTimestamps(state: GroupStore): GroupStore {
  let changed = false;

  const fixEntity = <T extends object>(entity: T): T => {
    let entityChanged = false;
    const next = { ...entity } as Record<string, unknown>;
    for (const field of ['updated_at', 'deleted_at'] as const) {
      const value = next[field];
      if (value instanceof Date) {
        next[field] = value.toISOString();
        entityChanged = true;
      }
    }
    if (!entityChanged) return entity;
    changed = true;
    return next as T;
  };

  const fixMap = <T extends object>(map: Record<string, T>) => {
    const next: Record<string, T> = {};
    let mapChanged = false;
    for (const [id, entity] of Object.entries(map ?? {})) {
      next[id] = fixEntity(entity);
      if (next[id] !== entity) mapChanged = true;
    }
    return mapChanged ? next : map;
  };

  const group = fixEntity(state.group);
  const members = fixMap(state.members ?? {});
  const binds = fixMap(state.binds ?? {});
  const expenses = fixMap(state.expenses ?? {});
  const activities = fixMap(state.activities ?? {});

  if (!state.activities) changed = true;

  return changed
    ? { ...state, group, members, binds, expenses, activities }
    : state.activities
      ? state
      : { ...state, activities };
}
