import type { ExpenseEntity, MemberEntity } from '@/src/types/group';

export type BucketLine = {
  expense_id: string;
  description: string;
  /** Live allocated members who are not the subject, sorted by member id. */
  counterpart_ids: string[];
  /** This member's net on the expense. Positive = paid for others. */
  amount_cents: number;
};

export type MemberBuckets = {
  paidFor: BucketLine[];
  owesFor: BucketLine[];
};

function liveIds(members: Record<string, MemberEntity>): Set<string> {
  return new Set(
    Object.values(members)
      .filter((m) => m.deleted_at == null)
      .map((m) => m.id),
  );
}

function ownShare(expense: ExpenseEntity, memberId: string): number {
  return (
    expense.allocations?.find((a) => a.member_id === memberId)?.amount_cents ?? 0
  );
}

function counterpartIds(
  expense: ExpenseEntity,
  memberId: string,
  live: Set<string>,
): string[] {
  const ids = (expense.allocations ?? [])
    .map((a) => a.member_id)
    .filter((id) => id !== memberId && live.has(id));
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

function newestFirst(a: ExpenseEntity, b: ExpenseEntity): number {
  return b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id);
}

/**
 * The expenses one member touched, split into what they paid for others and
 * what they owe because someone else paid. Amounts are that member's net on
 * each expense, so the two lists sum to their overall balance.
 */
export function memberBuckets(
  memberId: string,
  members: Record<string, MemberEntity>,
  expenses: Record<string, ExpenseEntity>,
): MemberBuckets {
  const live = liveIds(members);
  const paidFor: BucketLine[] = [];
  const owesFor: BucketLine[] = [];

  if (!live.has(memberId)) {
    return { paidFor, owesFor };
  }

  const ledger = Object.values(expenses)
    .filter((e) => e.deleted_at == null)
    .sort(newestFirst);

  for (const expense of ledger) {
    if (expense.payer_member_id === memberId) {
      const amount = expense.amount_cents - ownShare(expense, memberId);
      if (amount === 0) continue;
      paidFor.push({
        expense_id: expense.id,
        description: expense.description,
        counterpart_ids: counterpartIds(expense, memberId, live),
        amount_cents: amount,
      });
      continue;
    }

    const share = ownShare(expense, memberId);
    if (share === 0) continue;
    const payerLive = live.has(expense.payer_member_id);
    owesFor.push({
      expense_id: expense.id,
      description: expense.description,
      counterpart_ids: payerLive ? [expense.payer_member_id] : [],
      amount_cents: -share,
    });
  }

  return { paidFor, owesFor };
}
