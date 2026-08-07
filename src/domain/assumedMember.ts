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

/**
 * Whether any device has already claimed this member.
 *
 * This is the gate on inviting someone, and it is deliberately not
 * `bindingIsOpen`. That rule asks "may this device still change its mind?",
 * which expenses close for good (D-020). This one asks "is this slot still
 * free?" — a question expenses have nothing to do with, because handing a
 * named slot to the person who belongs in it moves no existing claim and
 * re-attributes no expense. A group three weeks and forty expenses into a
 * trip can still invite the friend nobody has claimed yet.
 *
 * Device-agnostic on purpose: a slot is taken once *anyone* holds it, not
 * once this device does.
 */
export function memberHasLiveBind(
  binds: Record<string, BindEntity>,
  memberId: string,
): boolean {
  return Object.values(binds).some(
    (b) => b.member_id === memberId && b.deleted_at == null,
  );
}
