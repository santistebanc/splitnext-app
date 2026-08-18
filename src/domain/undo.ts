import { tombstoneExpense } from '@/src/domain/expense';
import type {
  ActivityEntity,
  ExpenseEntity,
  MemberEntity,
} from '@/src/types/group';

export const UNDOABLE_KINDS = [
  'expense_added',
  'expense_deleted',
  'member_kicked',
] as const;

export type UndoableKind = (typeof UNDOABLE_KINDS)[number];

export function isUndoableKind(kind: string): kind is UndoableKind {
  return (UNDOABLE_KINDS as readonly string[]).includes(kind);
}

export function activityCanUndo(
  activity: ActivityEntity,
  assumedMemberId: string | null,
): boolean {
  if (!assumedMemberId) return false;
  if (activity.deleted_at != null) return false;
  if (activity.actor_member_id !== assumedMemberId) return false;
  if (!isUndoableKind(activity.kind)) return false;
  return activity.undo_snapshot != null;
}

function tombstoneActivity(
  activity: ActivityEntity,
  at: string,
): ActivityEntity {
  return {
    ...activity,
    version: activity.version + 1,
    updated_at: at,
    deleted_at: at,
  };
}

function asExpense(snapshot: unknown): ExpenseEntity | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const row = snapshot as Partial<ExpenseEntity>;
  if (!row.id || !Number.isInteger(row.amount_cents) || (row.amount_cents ?? 0) <= 0) {
    return null;
  }
  return snapshot as ExpenseEntity;
}

function asMember(snapshot: unknown): MemberEntity | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const row = snapshot as Partial<MemberEntity>;
  if (!row.id || typeof row.display_name !== 'string') return null;
  return snapshot as MemberEntity;
}

export type UndoPlan = {
  activity: ActivityEntity;
  expense?: ExpenseEntity;
  member?: MemberEntity;
};

export function planUndo(input: {
  activity: ActivityEntity;
  assumedMemberId: string | null;
  expense?: ExpenseEntity;
  member?: MemberEntity;
  at: string;
}): UndoPlan | null {
  const { activity, assumedMemberId, expense, member, at } = input;
  if (!activityCanUndo(activity, assumedMemberId)) return null;

  if (activity.kind === 'expense_added') {
    if (!expense || expense.deleted_at != null) return null;
    const snapshot = asExpense(activity.undo_snapshot);
    if (!snapshot || expense.version !== snapshot.version) return null;
    const next = tombstoneExpense(expense, at);
    if (!next) return null;
    return { expense: next, activity: tombstoneActivity(activity, at) };
  }

  if (activity.kind === 'expense_deleted') {
    if (!expense || expense.deleted_at == null) return null;
    const snapshot = asExpense(activity.undo_snapshot);
    if (!snapshot) return null;
    return {
      expense: {
        ...snapshot,
        version: expense.version + 1,
        updated_at: at,
        deleted_at: null,
      },
      activity: tombstoneActivity(activity, at),
    };
  }

  if (activity.kind === 'member_kicked') {
    if (!member || member.deleted_at == null) return null;
    const snapshot = asMember(activity.undo_snapshot);
    if (!snapshot) return null;
    return {
      member: {
        ...snapshot,
        version: member.version + 1,
        updated_at: at,
        deleted_at: null,
      },
      activity: tombstoneActivity(activity, at),
    };
  }

  return null;
}
