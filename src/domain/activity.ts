import type { ActivityEntity, ExpenseEntity, MemberEntity } from '@/src/types/group';
import { planUndo } from '@/src/domain/undo';
import { formatMoney, memberLabel } from '@/src/ui/format';

export type ActivityKind =
  | 'expense_added'
  | 'expense_edited'
  | 'expense_deleted'
  | 'member_kicked'
  | 'member_renamed';

export type ExpenseActivityInput = {
  id: string;
  groupId: string;
  actorMemberId: string;
  expense: Pick<ExpenseEntity, 'id' | 'group_id'> | ExpenseEntity;
  at: string;
  snapshot?: ExpenseEntity | null;
};

export type MemberActivityInput = {
  id: string;
  groupId: string;
  actorMemberId: string;
  member: Pick<MemberEntity, 'id' | 'group_id'> | MemberEntity;
  at: string;
  snapshot?: MemberEntity | null;
};

export type ActivityLine = {
  id: string;
  kind: ActivityKind;
  who: string;
  description: string;
  amount?: string;
  at: string;
  canUndo: boolean;
};

const EXPENSE_KINDS = new Set<ActivityKind>([
  'expense_added',
  'expense_edited',
  'expense_deleted',
]);

function expenseActivity(
  kind: ActivityKind,
  input: ExpenseActivityInput,
): ActivityEntity | null {
  const { id, groupId, actorMemberId, expense, at, snapshot } = input;
  if (!id || !groupId || !actorMemberId || !expense.id) return null;
  if (expense.group_id !== groupId) return null;
  return {
    id,
    group_id: groupId,
    kind,
    actor_member_id: actorMemberId,
    expense_id: expense.id,
    member_id: '',
    version: 1,
    updated_at: at,
    deleted_at: null,
    ...(snapshot ? { undo_snapshot: snapshot } : {}),
  };
}

function memberActivity(
  kind: ActivityKind,
  input: MemberActivityInput,
): ActivityEntity | null {
  const { id, groupId, actorMemberId, member, at, snapshot } = input;
  if (!id || !groupId || !actorMemberId || !member.id) return null;
  if (member.group_id !== groupId) return null;
  return {
    id,
    group_id: groupId,
    kind,
    actor_member_id: actorMemberId,
    expense_id: '',
    member_id: member.id,
    version: 1,
    updated_at: at,
    deleted_at: null,
    ...(snapshot ? { undo_snapshot: snapshot } : {}),
  };
}

export function activityForExpenseAdded(
  input: ExpenseActivityInput,
): ActivityEntity | null {
  return expenseActivity('expense_added', input);
}

export function activityForExpenseEdited(
  input: ExpenseActivityInput,
): ActivityEntity | null {
  return expenseActivity('expense_edited', input);
}

export function activityForExpenseDeleted(
  input: ExpenseActivityInput,
): ActivityEntity | null {
  return expenseActivity('expense_deleted', input);
}

export function activityForMemberKicked(
  input: MemberActivityInput,
): ActivityEntity | null {
  return memberActivity('member_kicked', input);
}

export function activityForMemberRenamed(
  input: MemberActivityInput,
): ActivityEntity | null {
  return memberActivity('member_renamed', input);
}

function actorLabel(
  members: Record<string, MemberEntity>,
  actorId: string,
  assumedMemberId: string | null,
): string | null {
  const actor = members[actorId];
  if (!actor || actor.deleted_at != null) return null;
  return memberLabel(actor.display_name, actorId === assumedMemberId);
}

function expenseDescription(expense: ExpenseEntity): string {
  return expense.description.trim() || '(no description)';
}

function lineCanUndo(
  activity: ActivityEntity,
  assumedMemberId: string | null,
  members: Record<string, MemberEntity>,
  expenses: Record<string, ExpenseEntity>,
): boolean {
  return (
    planUndo({
      activity,
      assumedMemberId,
      expense: expenses[activity.expense_id],
      member: members[activity.member_id],
      at: activity.updated_at,
    }) != null
  );
}

export function formatActivityLine(
  activity: ActivityEntity,
  members: Record<string, MemberEntity>,
  expenses: Record<string, ExpenseEntity>,
  currency: string,
  assumedMemberId: string | null,
): ActivityLine | null {
  if (activity.deleted_at != null) return null;
  const who = actorLabel(members, activity.actor_member_id, assumedMemberId);
  if (!who) return null;

  if (EXPENSE_KINDS.has(activity.kind)) {
    const expense = expenses[activity.expense_id];
    if (!expense) return null;
    if (activity.kind !== 'expense_deleted' && expense.deleted_at != null) {
      return null;
    }
    return {
      id: activity.id,
      kind: activity.kind,
      who,
      description: expenseDescription(expense),
      amount: formatMoney(expense.amount_cents, currency),
      at: activity.updated_at,
      canUndo: lineCanUndo(activity, assumedMemberId, members, expenses),
    };
  }

  if (activity.kind === 'member_kicked' || activity.kind === 'member_renamed') {
    const member = members[activity.member_id];
    if (!member) return null;
    return {
      id: activity.id,
      kind: activity.kind,
      who,
      description: memberLabel(
        member.display_name,
        activity.member_id === assumedMemberId,
      ),
      at: activity.updated_at,
      canUndo: lineCanUndo(activity, assumedMemberId, members, expenses),
    };
  }

  return null;
}

/** Plain-text sentence for push / toast-style surfaces. */
export function formatActivityLinePlain(line: ActivityLine): string {
  if (line.kind === 'expense_edited') {
    return `${line.who} edited ${line.description}${line.amount ? ` ${line.amount}` : ''}`;
  }
  if (line.kind === 'expense_deleted') {
    return `${line.who} deleted ${line.description}${line.amount ? ` ${line.amount}` : ''}`;
  }
  if (line.kind === 'member_kicked') {
    return `${line.who} removed ${line.description}`;
  }
  if (line.kind === 'member_renamed') {
    return `${line.who} renamed ${line.description}`;
  }
  return `${line.who} added ${line.description}${line.amount ? ` ${line.amount}` : ''}`;
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

/** New live activities in `after` that were not in `before`, excluding this device. */
export function activitiesFromOthers(
  before: Record<string, ActivityEntity>,
  after: Record<string, ActivityEntity>,
  assumedMemberId: string | null,
): ActivityEntity[] {
  if (!assumedMemberId) return [];
  const added = Object.values(after).filter((activity) => {
    if (activity.deleted_at != null) return false;
    if (before[activity.id]) return false;
    return activity.actor_member_id !== assumedMemberId;
  });
  if (added.length === 0) return [];
  return sortActivities(
    Object.fromEntries(added.map((activity) => [activity.id, activity])),
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
