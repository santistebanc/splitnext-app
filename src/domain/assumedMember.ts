import type { BindEntity } from '@/src/types/group';

/** Active (non-tombstoned) bind for this device → assumed member id. */
export function assumedMemberIdFromBinds(
  binds: Record<string, BindEntity>,
  deviceUserId: string,
): string | null {
  for (const bind of Object.values(binds)) {
    if (bind.device_user_id === deviceUserId && bind.deleted_at == null) {
      return bind.member_id;
    }
  }
  return null;
}

export function deviceHasActiveBind(
  binds: Record<string, BindEntity>,
  deviceUserId: string,
): boolean {
  return assumedMemberIdFromBinds(binds, deviceUserId) != null;
}
