import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import {
  createGroupRemote,
  fetchEntity,
  listRoster,
  mergeEntities,
  mintRealtimeAuth,
} from '@/src/api/edge';
import { env } from '@/src/config/env';
import { deviceHasActiveBind } from '@/src/domain/assumedMember';
import {
  shouldAcceptVersion,
  sortByFlushOrder,
  type EntityType,
} from '@/src/domain/version';
import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import {
  addLobbyGroupId,
  getAccessToken,
  listLobbyGroupIds,
  saveAccessToken,
} from '@/src/secrets/tokens';
import { getGroupStore, initLocalGroup } from '@/src/store/groupStore';
import type {
  BindEntity,
  GroupEntity,
  MemberEntity,
  SyncEntity,
} from '@/src/types/group';
import {
  queueAfterMergeResults,
  shouldAttemptFlush,
} from '@/src/sync/queuePolicy';

const channels = new Map<string, RealtimeChannel>();
/** Serializes flush/sync per group so bump and foreground cannot race the queue. */
const groupWork = new Map<string, Promise<void>>();

function runExclusive(groupId: string, work: () => Promise<void>): Promise<void> {
  const prev = groupWork.get(groupId) ?? Promise.resolve();
  const next = prev.then(work, work);
  groupWork.set(
    groupId,
    next.finally(() => {
      if (groupWork.get(groupId) === next) groupWork.delete(groupId);
    }),
  );
  return next;
}

function supabaseClient() {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function applyEntityToStore(
  groupId: string,
  entityType: string,
  entity: SyncEntity,
): void {
  const store$ = getGroupStore(groupId);

  if (entityType === 'groups') {
    const remote = entity as GroupEntity;
    const local = store$.group.get();
    if (shouldAcceptVersion(remote.version, local.version)) {
      store$.group.set(remote);
      store$.syncStatus.set('fetched');
    }
    return;
  }

  if (entityType === 'members') {
    const remote = entity as MemberEntity;
    const members = store$.members.get() ?? {};
    const localVersion = members[remote.id]?.version ?? -1;
    if (shouldAcceptVersion(remote.version, localVersion)) {
      store$.members.set({ ...members, [remote.id]: remote });
      store$.syncStatus.set('fetched');
    }
    return;
  }

  if (entityType === 'binds') {
    const remote = entity as BindEntity;
    const binds = store$.binds.get() ?? {};
    const localVersion = binds[remote.id]?.version ?? -1;
    if (shouldAcceptVersion(remote.version, localVersion)) {
      store$.binds.set({ ...binds, [remote.id]: remote });
      store$.syncStatus.set('fetched');
    }
  }
}

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
    try {
      await startWakeSubscription(groupId);
    } catch (wakeErr) {
      store$.lastError.set(
        wakeErr instanceof Error ? `wake:${wakeErr.message}` : 'wake_failed',
      );
    }
    return groupId;
  } catch (err) {
    store$.syncStatus.set('error');
    store$.lastError.set(err instanceof Error ? err.message : 'create_failed');
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
    ...store$.queue.get(),
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
    ...store$.queue.get(),
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
  if (deviceHasActiveBind(store$.binds.get(), deviceUserId)) {
    store$.lastError.set('already_bound');
    return;
  }

  const member = (store$.members.get() ?? {})[memberId];
  if (!member || member.deleted_at != null) {
    store$.lastError.set('member_missing');
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
    ...store$.queue.get(),
    {
      entity_type: 'binds',
      id: bind.id,
      version: bind.version,
      payload: bind,
    },
  ]);
  await flushQueue(groupId);
}

async function flushQueueInner(groupId: string): Promise<void> {
  const store$ = getGroupStore(groupId);
  const queue = sortByFlushOrder(store$.queue.get());
  if (!shouldAttemptFlush(queue.length)) return;

  const accessToken = await getAccessToken(groupId);
  const deviceUserId = await getOrCreateDeviceUserId();
  if (!accessToken) {
    store$.syncStatus.set('error');
    store$.lastError.set('missing_access_token');
    return;
  }

  store$.syncStatus.set('merging');
  try {
    const { results } = await mergeEntities({
      group_id: groupId,
      device_user_id: deviceUserId,
      access_token: accessToken,
      items: queue,
    });

    store$.queue.set(queueAfterMergeResults(queue, results));
    store$.syncStatus.set('on_server');
    store$.lastError.set(null);
  } catch (err) {
    store$.syncStatus.set('error');
    store$.lastError.set(err instanceof Error ? err.message : 'merge_failed');
  }
}

export async function flushQueue(groupId: string): Promise<void> {
  return runExclusive(groupId, () => flushQueueInner(groupId));
}

export async function applyRemoteFetch(
  groupId: string,
  entityType: string,
  id: string,
): Promise<void> {
  const accessToken = await getAccessToken(groupId);
  const deviceUserId = await getOrCreateDeviceUserId();
  if (!accessToken) return;

  try {
    const { entity } = await fetchEntity({
      group_id: groupId,
      device_user_id: deviceUserId,
      access_token: accessToken,
      entity_type: entityType,
      id,
    });
    applyEntityToStore(groupId, entityType, entity);
  } catch (err) {
    const store$ = getGroupStore(groupId);
    store$.lastError.set(
      err instanceof Error ? `fetch:${err.message}` : 'fetch_failed',
    );
  }
}

async function pullRoster(groupId: string): Promise<void> {
  const store$ = getGroupStore(groupId);
  const accessToken = await getAccessToken(groupId);
  const deviceUserId = await getOrCreateDeviceUserId();
  if (!accessToken) return;

  try {
    const { members, binds } = await listRoster({
      group_id: groupId,
      device_user_id: deviceUserId,
      access_token: accessToken,
    });
    for (const member of members) {
      applyEntityToStore(groupId, 'members', member);
    }
    for (const bind of binds) {
      applyEntityToStore(groupId, 'binds', bind);
    }
    store$.lastError.set(null);
  } catch (err) {
    store$.lastError.set(
      err instanceof Error ? `roster:${err.message}` : 'roster_failed',
    );
  }
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

export async function startWakeSubscription(groupId: string): Promise<void> {
  if (channels.has(groupId)) return;

  const accessToken = await getAccessToken(groupId);
  const deviceUserId = await getOrCreateDeviceUserId();
  if (!accessToken) return;

  const auth = await mintRealtimeAuth({
    group_id: groupId,
    device_user_id: deviceUserId,
    access_token: accessToken,
  });

  const client = supabaseClient();
  if (auth.jwt) {
    client.realtime.setAuth(auth.jwt);
  }

  const channel = client
    .channel(auth.channel)
    .on('broadcast', { event: 'wake' }, (msg) => {
      const payload = msg.payload as {
        group_id?: string;
        entity_type?: string;
        id?: string;
        version?: number;
      };
      if (
        payload.group_id === groupId &&
        payload.entity_type &&
        payload.id
      ) {
        void applyRemoteFetch(
          groupId,
          payload.entity_type as EntityType,
          payload.id,
        );
      }
    })
    .subscribe();

  channels.set(groupId, channel);
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
