import { fetchEntity, listRoster } from '@/src/api/edge';
import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import { getAccessToken } from '@/src/secrets/tokens';
import { getGroupStore } from '@/src/store/groupStore';
import { applyRemoteEntity } from '@/src/sync/inboundApply';
import { errorAfterOutcome, syncError } from '@/src/sync/syncErrors';
import type { SyncEntity } from '@/src/types/group';

function readInboundState(groupId: string) {
  const store$ = getGroupStore(groupId);
  return {
    group: store$.group.get(),
    members: store$.members.get() ?? {},
    binds: store$.binds.get() ?? {},
    expenses: store$.expenses.get() ?? {},
  };
}

export function commitRemoteEntity(
  groupId: string,
  entityType: string,
  entity: SyncEntity,
): boolean {
  const store$ = getGroupStore(groupId);
  const next = applyRemoteEntity(
    readInboundState(groupId),
    entityType,
    entity,
  );
  if (!next) return false;
  store$.group.set(next.group);
  store$.members.set(next.members);
  store$.binds.set(next.binds);
  store$.expenses.set(next.expenses);
  store$.syncStatus.set('fetched');
  return true;
}

export async function applyRemoteFetch(
  groupId: string,
  entityType: string,
  id: string,
): Promise<void> {
  const store$ = getGroupStore(groupId);
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
    commitRemoteEntity(groupId, entityType, entity);
    store$.lastError.set(errorAfterOutcome('success', null));
  } catch (err) {
    store$.lastError.set(
      errorAfterOutcome(
        'failure',
        syncError(
          'fetch_failed',
          err instanceof Error ? err.message : 'fetch_failed',
        ),
      ),
    );
  }
}

export async function pullRoster(groupId: string): Promise<void> {
  const store$ = getGroupStore(groupId);
  const accessToken = await getAccessToken(groupId);
  const deviceUserId = await getOrCreateDeviceUserId();
  if (!accessToken) return;

  try {
    const { members, binds, expenses = [] } = await listRoster({
      group_id: groupId,
      device_user_id: deviceUserId,
      access_token: accessToken,
    });
    for (const member of members) {
      commitRemoteEntity(groupId, 'members', member);
    }
    for (const bind of binds) {
      commitRemoteEntity(groupId, 'binds', bind);
    }
    for (const expense of expenses) {
      commitRemoteEntity(groupId, 'expenses', expense);
    }
    store$.lastError.set(errorAfterOutcome('success', null));
  } catch (err) {
    store$.lastError.set(
      errorAfterOutcome(
        'failure',
        syncError(
          'roster_failed',
          err instanceof Error ? err.message : 'roster_failed',
        ),
      ),
    );
  }
}
