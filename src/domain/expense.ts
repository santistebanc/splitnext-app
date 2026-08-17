import { participantsForSplit, splitEqually } from '@/src/domain/split';
import type { ExpenseEntity } from '@/src/types/group';

export type ExpensePatch = {
  payerMemberId: string;
  amountCents: number;
  description: string;
  participantMemberIds: readonly string[];
};

/**
 * Next version of an expense with a new equal split, or null when there is
 * nothing to write: invalid money, a payer or share set that is not live,
 * or the same payer / amount / participants / trimmed description as now.
 */
export function patchExpense(
  expense: ExpenseEntity,
  liveMemberIds: readonly string[],
  patch: ExpensePatch,
  updatedAt: string,
): ExpenseEntity | null {
  if (!Number.isInteger(patch.amountCents) || patch.amountCents <= 0) {
    return null;
  }
  if (!liveMemberIds.includes(patch.payerMemberId)) {
    return null;
  }
  const split = participantsForSplit(
    liveMemberIds,
    patch.participantMemberIds,
  );
  if (!split.ok) return null;

  const description = patch.description.trim();
  const currentIds = [...new Set((expense.allocations ?? []).map((a) => a.member_id))]
    .sort();
  const sameParticipants =
    currentIds.length === split.memberIds.length &&
    currentIds.every((id, i) => id === split.memberIds[i]);
  if (
    expense.payer_member_id === patch.payerMemberId &&
    expense.amount_cents === patch.amountCents &&
    expense.description.trim() === description &&
    sameParticipants
  ) {
    return null;
  }

  return {
    ...expense,
    payer_member_id: patch.payerMemberId,
    amount_cents: patch.amountCents,
    description,
    allocations: splitEqually(patch.amountCents, split.memberIds),
    version: expense.version + 1,
    updated_at: updatedAt,
  };
}
