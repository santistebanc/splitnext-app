import type { BindEntity, ExpenseEntity } from '@/src/types/group';

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

/** A live bind pointing at this member means someone has joined that slot. */
export function memberIsClaimed(
  binds: Record<string, BindEntity>,
  memberId: string,
): boolean {
  return Object.values(binds).some(
    (bind) => bind.member_id === memberId && bind.deleted_at == null,
  );
}

/**
 * Whether the group still has no live expense.
 *
 * The hub shows names and add member in that state; the first live expense
 * switches it to balances and tap-to-detail. Soft-deleted expenses do not
 * count.
 */
export function bindingIsOpen(
  expenses: Record<string, ExpenseEntity>,
): boolean {
  return !Object.values(expenses).some((e) => e.deleted_at == null);
}
