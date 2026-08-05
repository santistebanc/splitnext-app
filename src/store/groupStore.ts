import { observable, type Observable } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import type { GroupEntity, GroupStore } from '@/src/types/group';
import { ensurePersistConfigured, getPersistPlugin } from '@/src/store/persist';

const cache = new Map<string, Observable<GroupStore>>();

export function getGroupStore(groupId: string): Observable<GroupStore> {
  const existing = cache.get(groupId);
  if (existing) return existing;

  ensurePersistConfigured();

  const store$ = observable<GroupStore>({
    group: {
      id: groupId,
      version: 0,
      updated_at: new Date(0).toISOString(),
      deleted_at: null,
      name: '',
      currency_label: 'EUR',
      is_closed: false,
    },
    members: {},
    binds: {},
    syncStatus: 'local',
    lastError: null,
    queue: [],
  });

  syncObservable(store$, {
    persist: {
      name: `group_${groupId}`,
      plugin: getPersistPlugin(),
      retrySync: true,
    },
  });

  cache.set(groupId, store$);
  return store$;
}

export function initLocalGroup(
  store$: Observable<GroupStore>,
  group: GroupEntity,
): void {
  store$.group.set(group);
  store$.syncStatus.set('local');
  store$.lastError.set(null);
}
