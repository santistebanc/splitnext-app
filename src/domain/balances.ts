import type { ExpenseEntity, MemberEntity } from '@/src/types/group';

export type Balance = {
  member_id: string;
  display_name: string;
  /** Σ paid − Σ owed. Positive means the group owes them. */
  net_cents: number;
};

/**
 * Each live member's net position across the group's live expenses.
 *
 * Paying credits you the full amount; your allocation debits you your share.
 * Because `splitEqually` allocates every cent of the expense it splits, the
 * nets sum to zero across everyone the expenses touch — that identity is what
 * makes the list trustworthy at a glance.
 *
 * Two shapes are tolerated rather than trusted: an expense with no allocations
 * (recorded before splits existed) credits its payer and debits nobody, and an
 * allocation naming a member this device has not seen — or has since seen
 * soft-deleted — is skipped, as is that member's paying. Both leave
 * the visible list unbalanced, which is honest — the alternative is inventing
 * a debt against a member that may never arrive.
 */
export function computeBalances(
  members: Record<string, MemberEntity>,
  expenses: Record<string, ExpenseEntity>,
): Balance[] {
  const live = Object.values(members).filter((m) => m.deleted_at == null);
  const net = new Map(live.map((m) => [m.id, 0]));

  for (const expense of Object.values(expenses)) {
    if (expense.deleted_at != null) continue;

    const paid = net.get(expense.payer_member_id);
    if (paid !== undefined) {
      net.set(expense.payer_member_id, paid + expense.amount_cents);
    }

    for (const allocation of expense.allocations ?? []) {
      const owed = net.get(allocation.member_id);
      if (owed === undefined) continue;
      net.set(allocation.member_id, owed - allocation.amount_cents);
    }
  }

  return live
    .map((m) => ({
      member_id: m.id,
      display_name: m.display_name,
      net_cents: net.get(m.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        a.net_cents - b.net_cents ||
        a.display_name.localeCompare(b.display_name) ||
        a.member_id.localeCompare(b.member_id),
    );
}
