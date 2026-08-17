import { assumedMemberIdFromBinds } from '@/src/domain/assumedMember';
import type { BindEntity } from '@/src/types/group';

export type BindOnceResult = 'bind' | 'noop' | 'locked';

/**
 * This device may bind only once. Leave tombstones the bind, which is what
 * lets the same install bind again. Re-pointing at a different member is
 * refused — assumed member is set at create or join and does not move.
 */
export function bindOnce(
  binds: Record<string, BindEntity>,
  deviceUserId: string,
  memberId: string,
): BindOnceResult {
  const liveId = assumedMemberIdFromBinds(binds, deviceUserId);
  if (liveId == null) return 'bind';
  if (liveId === memberId) return 'noop';
  return 'locked';
}

/**
 * Soft-delete a live bind at the next version so the member slot remains
 * and another device can be bound later. Already-tombstoned binds are a no-op.
 */
export function tombstoneBind(
  bind: BindEntity,
  deletedAt: string,
): BindEntity | null {
  if (bind.deleted_at != null) return null;
  return {
    ...bind,
    version: bind.version + 1,
    updated_at: deletedAt,
    deleted_at: deletedAt,
  };
}
