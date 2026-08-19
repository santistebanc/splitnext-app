import {
  formatActivityLine,
  formatActivityLinePlain,
  type ActivityKind,
} from '../../src/domain/activity';
import type {
  ActivityEntity,
  ExpenseEntity,
  MemberEntity,
} from '../../src/types/group';

export function activityPushMessage(
  activity: ActivityEntity,
  members: Record<string, MemberEntity>,
  expenses: Record<string, ExpenseEntity>,
  currency: string,
): { title: string; body: string } | null {
  const line = formatActivityLine(
    activity,
    members,
    expenses,
    currency,
    null,
  );
  if (!line) return null;
  return {
    title: pushTitleForKind(line.kind),
    body: formatActivityLinePlain(line),
  };
}

function pushTitleForKind(kind: ActivityKind): string {
  if (kind === 'expense_edited') return 'Expense edited';
  if (kind === 'expense_deleted') return 'Expense deleted';
  if (kind === 'member_kicked') return 'Member removed';
  if (kind === 'member_renamed') return 'Member renamed';
  if (kind === 'member_joined') return 'Member joined';
  if (kind === 'member_left') return 'Member left';
  if (kind === 'group_renamed') return 'Group renamed';
  return 'New expense';
}
