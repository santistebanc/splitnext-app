import type { ActivityEntity, ExpenseEntity, MemberEntity } from '@/src/types/group';
import { formatMoney, memberLabel } from '@/src/ui/format';

export type ActivityKind = 'expense_added';

export type ActivityInput = {
  id: string;
  groupId: string;
  actorMemberId: string;
  expense: Pick<ExpenseEntity, 'id' | 'group_id'>;
  at: string;
};

export type ActivityLine = {
  who: string;
  description: string;
  amount: string;
};

/** First version of an expense-added event, or null when ids are missing. */
export function activityForExpenseAdded(input: ActivityInput): ActivityEntity | null {
  const { id, groupId, actorMemberId, expense, at } = input;
  if (!id || !groupId || !actorMemberId || !expense.id) return null;
  if (expense.group_id !== groupId) return null;
  return {
    id,
    group_id: groupId,
    kind: 'expense_added',
    actor_member_id: actorMemberId,
    expense_id: expense.id,
    version: 1,
    updated_at: at,
    deleted_at: null,
  };
}

export function formatActivityLine(
  activity: ActivityEntity,
  members: Record<string, MemberEntity>,
  expenses: Record<string, ExpenseEntity>,
  currency: string,
  assumedMemberId: string | null,
): ActivityLine | null {
  if (activity.deleted_at != null) return null;
  if (activity.kind !== 'expense_added') return null;
  const actor = members[activity.actor_member_id];
  if (!actor || actor.deleted_at != null) return null;
  const expense = expenses[activity.expense_id];
  if (!expense || expense.deleted_at != null) return null;
  return {
    who: memberLabel(
      actor.display_name,
      activity.actor_member_id === assumedMemberId,
    ),
    description: expense.description.trim() || '(no description)',
    amount: formatMoney(expense.amount_cents, currency),
  };
}

/** Live activities, newest first. */
export function sortActivities(
  activities: Record<string, ActivityEntity>,
): ActivityEntity[] {
  return Object.values(activities)
    .filter((a) => a.deleted_at == null)
    .sort(
      (a, b) =>
        b.updated_at.localeCompare(a.updated_at) ||
        b.id.localeCompare(a.id),
    );
}

/** Readable activity lines for live events, newest first. */
export function activityLines(
  activities: Record<string, ActivityEntity>,
  members: Record<string, MemberEntity>,
  expenses: Record<string, ExpenseEntity>,
  currency: string,
  assumedMemberId: string | null,
  limit?: number,
): ActivityLine[] {
  const lines = sortActivities(activities)
    .map((activity) =>
      formatActivityLine(activity, members, expenses, currency, assumedMemberId),
    )
    .filter((line): line is ActivityLine => line != null);
  return limit != null ? lines.slice(0, limit) : lines;
}
