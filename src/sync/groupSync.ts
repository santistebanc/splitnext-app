import * as Crypto from 'expo-crypto';
import { createGroupRemote } from '@/src/api/edge';
import { deviceHasActiveBind } from '@/src/domain/assumedMember';
import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import {
  addLobbyGroupId,
  listLobbyGroupIds,
  saveAccessToken,
} from '@/src/secrets/tokens';
import { getGroupStore, initLocalGroup } from '@/src/store/groupStore';
import { runExclusive } from '@/src/sync/exclusive';
import {
  applyRemoteFetch,
  pullRoster,
} from '@/src/sync/inbound';
import { flushQueue, flushQueueInner } from '@/src/sync/outbound';
import { syncError } from '@/src/sync/syncErrors';
import { startWakeSubscription } from '@/src/sync/wake';
import type {
  BindEntity,
  GroupEntity,
  MemberEntity,
} from '@/src/types/group';

export { flushQueue } from '@/src/sync/outbound';
export { applyRemoteFetch } from '@/src/sync/inbound';
export { startWakeSubscription } from '@/src/sync/wake';

export async function createGroup(): Promise<string> {
  const deviceUserId = await getOrCreateDeviceUserId();
  const groupId = Crypto.randomUUID();
  const updatedAt = new Date().toISOString();
  const local: GroupEntity = {
    id: groupId,
    version: 1,
    updated_at: updatedAt,
    deleted_at: null,
    name: '',
    currency_label: 'EUR',
    is_closed: false,
  };

  const store$ = getGroupStore(groupId);
  initLocalGroup(store$, local);
  store$.syncStatus.set('creating');

  try {
    const { access_token, group } = await createGroupRemote({
      group_id: groupId,
      device_user_id: deviceUserId,
      name: local.name,
      currency_label: local.currency_label,
      updated_at: local.updated_at,
    });
    await saveAccessToken(groupId, access_token);
    await addLobbyGroupId(groupId);
    store$.group.set(group);
    store$.syncStatus.set('on_server');
    store$.lastError.set(null);
    try {
      await startWakeSubscription(groupId);
    } catch (wakeErr) {
      store$.lastError.set(
        syncError(
          'wake_failed',
          wakeErr instanceof Error ? wakeErr.message : 'wake_failed',
        ),
      );
    }
    return groupId;
  } catch (err) {
    store$.syncStatus.set('error');
    store$.lastError.set(
      syncError(
        'create_failed',
        err instanceof Error ? err.message : 'create_failed',
      ),
    );
    throw err;
  }
}

export async function bumpGroupName(
  groupId: string,
  name: string,
): Promise<void> {
  const store$ = getGroupStore(groupId);
  const current = store$.group.get();
  const next: GroupEntity = {
    ...current,
    name,
    version: current.version + 1,
    updated_at: new Date().toISOString(),
  };
  store$.group.set(next);
  store$.queue.set([
    ...(store$.queue.get() ?? []),
    {
      entity_type: 'groups',
      id: groupId,
      version: next.version,
      payload: next,
    },
  ]);
  await flushQueue(groupId);
}

export async function addMember(
  groupId: string,
  displayName: string,
): Promise<string> {
  const memberId = Crypto.randomUUID();
  const member: MemberEntity = {
    id: memberId,
    group_id: groupId,
    display_name: displayName.trim(),
    version: 1,
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };
  const store$ = getGroupStore(groupId);
  store$.members.set({ ...(store$.members.get() ?? {}), [memberId]: member });
  store$.queue.set([
    ...(store$.queue.get() ?? []),
    {
      entity_type: 'members',
      id: memberId,
      version: member.version,
      payload: member,
    },
  ]);
  await flushQueue(groupId);
  return memberId;
}

export async function bindMe(
  groupId: string,
  memberId: string,
): Promise<void> {
  const deviceUserId = await getOrCreateDeviceUserId();
  const store$ = getGroupStore(groupId);
  if (deviceHasActiveBind(store$.binds.get() ?? {}, deviceUserId)) {
    store$.lastError.set(syncError('already_bound'));
    return;
  }

  const member = (store$.members.get() ?? {})[memberId];
  if (!member || member.deleted_at != null) {
    store$.lastError.set(syncError('member_missing'));
    return;
  }

  const bind: BindEntity = {
    id: Crypto.randomUUID(),
    group_id: groupId,
    device_user_id: deviceUserId,
    member_id: memberId,
    version: 1,
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };
  store$.binds.set({ ...(store$.binds.get() ?? {}), [bind.id]: bind });
  store$.queue.set([
    ...(store$.queue.get() ?? []),
    {
      entity_type: 'binds',
      id: bind.id,
      version: bind.version,
      payload: bind,
    },
  ]);
  await flushQueue(groupId);
}

/** Flush outbound queue then pull remote group + roster. Serialized per group. */
export async function syncGroup(groupId: string): Promise<void> {
  return runExclusive(groupId, async () => {
    getGroupStore(groupId);
    await flushQueueInner(groupId);
    await applyRemoteFetch(groupId, 'groups', groupId);
    await pullRoster(groupId);
  });
}

/** Foreground / lobby-wide catch-up for every group this device knows. */
export async function syncAllLobbyGroups(): Promise<void> {
  const ids = await listLobbyGroupIds();
  await Promise.all(
    ids.map(async (id) => {
      try {
        await syncGroup(id);
      } catch {
        // Isolate failures so one group cannot block the others.
      }
    }),
  );
}

export async function openGroup(groupId: string): Promise<void> {
  getGroupStore(groupId);
  try {
    await startWakeSubscription(groupId);
  } catch {
    // Opening a group for browse must not crash if Realtime is unavailable.
  }
  await syncGroup(groupId);
}
