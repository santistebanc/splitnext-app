import { mergeEntities } from '@/src/api/edge';
import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import { sortByFlushOrder } from '@/src/domain/version';
import { getAccessToken } from '@/src/secrets/tokens';
import { getGroupStore } from '@/src/store/groupStore';
import { runExclusive } from '@/src/sync/exclusive';
import {
  queueAfterMergeResults,
  shouldAttemptFlush,
} from '@/src/sync/queuePolicy';
import { errorAfterOutcome, syncError } from '@/src/sync/syncErrors';

export async function flushQueueInner(groupId: string): Promise<void> {
  const store$ = getGroupStore(groupId);
  const queue = sortByFlushOrder(store$.queue.get() ?? []);
  if (!shouldAttemptFlush(queue.length)) return;

  const accessToken = await getAccessToken(groupId);
  const deviceUserId = await getOrCreateDeviceUserId();
  if (!accessToken) {
    store$.syncStatus.set('error');
    store$.lastError.set(syncError('missing_token'));
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
    store$.lastError.set(errorAfterOutcome('success', null));
  } catch (err) {
    store$.syncStatus.set('error');
    store$.lastError.set(
      errorAfterOutcome(
        'failure',
        syncError(
          'merge_failed',
          err instanceof Error ? err.message : 'merge_failed',
        ),
      ),
    );
  }
}

export async function flushQueue(groupId: string): Promise<void> {
  return runExclusive(groupId, () => flushQueueInner(groupId));
}
