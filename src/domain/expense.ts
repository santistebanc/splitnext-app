import { allocateMixed } from '@/src/domain/allocateMixed';
import { participantsForSplit } from '@/src/domain/split';
import type { SplitAmongEntry } from '@/src/domain/splitEditor';
import type { Allocation, ExpenseEntity } from '@/src/types/group';

export type { SplitAmongEntry };

export type ExpensePatch = {
  payerMemberId: string;
  amountCents: number;
  description: string;
  splitAmong: readonly SplitAmongEntry[];
};

function intentKey(row: {
  member_id: string;
  share_units?: number | null;
  fixed_cents?: number | null;
}): string {
  const fixed =
    row.fixed_cents != null && row.fixed_cents > 0 ? String(row.fixed_cents) : '';
  const shares = fixed ? 1 : (row.share_units ?? 1);
  return `${row.member_id}:${shares}:${fixed}`;
}

function sameIntent(
  stored: readonly Allocation[] | undefined,
  splitAmong: readonly SplitAmongEntry[],
): boolean {
  const current = [...(stored ?? [])].map(intentKey).sort();
  const next = splitAmong
    .map((entry) =>
      intentKey({
        member_id: entry.memberId,
        share_units: entry.shareUnits,
        fixed_cents: entry.fixedCents,
      }),
    )
    .sort();
  return (
    current.length === next.length &&
    current.every((key, i) => key === next[i])
  );
}

function activeSplitAmong(
  splitAmong: readonly SplitAmongEntry[],
): SplitAmongEntry[] {
  return splitAmong.filter(
    (entry) =>
      entry.shareUnits > 0 ||
      (entry.fixedCents != null && entry.fixedCents > 0),
  );
}

export function buildExpenseAllocations(
  amountCents: number,
  liveMemberIds: readonly string[],
  splitAmong: readonly SplitAmongEntry[],
): Allocation[] | null {
  const active = activeSplitAmong(splitAmong);
  const split = participantsForSplit(
    liveMemberIds,
    active.map((entry) => entry.memberId),
  );
  if (!split.ok) return null;

  const byId = new Map(active.map((entry) => [entry.memberId, entry]));
  return allocateMixed(
    amountCents,
    split.memberIds.map((id) => {
      const entry = byId.get(id)!;
      return {
        id,
        shareUnits: entry.shareUnits,
        fixedCents: entry.fixedCents,
      };
    }),
  );
}

/**
 * Next version of an expense with a new split, or null when there is
 * nothing to write: invalid money, a payer or share set that is not live,
 * or the same payer / amount / split intent / trimmed description as now.
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
  const active = activeSplitAmong(patch.splitAmong);
  const allocations = buildExpenseAllocations(
    patch.amountCents,
    liveMemberIds,
    active,
  );
  if (!allocations) return null;

  const description = patch.description.trim();
  if (
    expense.payer_member_id === patch.payerMemberId &&
    expense.amount_cents === patch.amountCents &&
    expense.description.trim() === description &&
    sameIntent(expense.allocations, active)
  ) {
    return null;
  }

  return {
    ...expense,
    payer_member_id: patch.payerMemberId,
    amount_cents: patch.amountCents,
    description,
    allocations,
    version: expense.version + 1,
    updated_at: updatedAt,
  };
}
