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

/**
 * Whether this device may still say which member it is.
 *
 * Choosing is free until the group has money in it: before the first expense
 * a wrong tap costs nothing, so every member stays offerable and the choice
 * can be changed. The first live expense closes it, because expenses are
 * recorded against the payer and moving a bind after that would silently
 * re-attribute them. Reopening it later is a deliberate, explicit act — a
 * different rule, not this one.
 */
export function bindingIsOpen(
  expenses: Record<string, ExpenseEntity>,
): boolean {
  return !Object.values(expenses).some((e) => e.deleted_at == null);
}
