import type { BindEntity } from '@/src/types/group';

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
