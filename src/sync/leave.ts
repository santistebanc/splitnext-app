import { leaveGroupRemote } from '@/src/api/edge';
import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import { tombstoneBind } from '@/src/domain/bind';
import {
  deleteAccessToken,
  getAccessToken,
  removeLobbyGroupId,
} from '@/src/secrets/tokens';
import { getGroupStore } from '@/src/store/groupStore';
import { flushQueue } from '@/src/sync/outbound';
import { syncError } from '@/src/sync/syncErrors';
import { stopWakeSubscription } from '@/src/sync/wake';

/**
 * Unbind this device (soft-delete, flushed while the token still works),
 * revoke the token, then drop local access. Returns false if flush or
 * revoke failed — the lobby is not dropped.
 */
export async function leaveGroup(groupId: string): Promise<boolean> {
  const store$ = getGroupStore(groupId);
  const deviceUserId = await getOrCreateDeviceUserId();
  const binds = store$.binds.get() ?? {};
  const live = Object.values(binds).find(
    (b) => b.device_user_id === deviceUserId && b.deleted_at == null,
  );

  if (live) {
    const tombstone = tombstoneBind(live, new Date().toISOString());
    if (tombstone) {
      store$.binds.set({ ...binds, [tombstone.id]: tombstone });
      store$.queue.set([
        ...(store$.queue.get() ?? []),
        {
          entity_type: 'binds',
          id: tombstone.id,
          version: tombstone.version,
          payload: tombstone,
        },
      ]);
      await flushQueue(groupId);
      const leftover = (store$.queue.get() ?? []).some(
        (item) => item.id === tombstone.id,
      );
      if (leftover) {
        store$.lastError.set(syncError('leave_failed', 'merge_failed'));
        return false;
      }
    }
  }

  const accessToken = await getAccessToken(groupId);
  if (!accessToken) {
    store$.lastError.set(syncError('missing_token'));
    return false;
  }

  try {
    await leaveGroupRemote({
      group_id: groupId,
      device_user_id: deviceUserId,
      access_token: accessToken,
    });
  } catch (err) {
    store$.lastError.set(
      syncError(
        'leave_failed',
        err instanceof Error ? err.message : 'leave_failed',
      ),
    );
    return false;
  }

  stopWakeSubscription(groupId);
  await deleteAccessToken(groupId);
  await removeLobbyGroupId(groupId);
  store$.lastError.set(null);
  return true;
}
