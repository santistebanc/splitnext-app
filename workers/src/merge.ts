import {
  bindRow,
  expenseRow,
  groupRow,
  memberRow,
  shouldAccept,
  type MergeItem,
} from './entities';

export type MergeResult = {
  id: string;
  entity_type: string;
  version: number;
  status: 'accepted' | 'rejected' | 'error';
  reason?: string;
};

export type GroupStore = {
  getVersion(entityType: string, id: string): number;
  getMember(id: string): { id: string } | null;
  upsert(entityType: string, row: Record<string, unknown>): void;
};

export function mergeOne(
  store: GroupStore,
  groupId: string,
  item: MergeItem,
): MergeResult {
  const base = {
    id: item.id,
    entity_type: item.entity_type,
    version: item.version,
  };

  if (
    item.entity_type !== 'groups' &&
    item.entity_type !== 'members' &&
    item.entity_type !== 'binds' &&
    item.entity_type !== 'expenses'
  ) {
    return { ...base, status: 'error', reason: 'unsupported_entity' };
  }

  if (item.entity_type === 'groups' && item.id !== groupId) {
    return { ...base, status: 'error', reason: 'group_mismatch' };
  }

  if (item.entity_type !== 'groups') {
    const payloadGroup = item.payload.group_id as string | undefined;
    if (payloadGroup && payloadGroup !== groupId) {
      return { ...base, status: 'error', reason: 'group_mismatch' };
    }
  }

  const storedVersion = store.getVersion(item.entity_type, item.id);
  if (!shouldAccept(item.version, storedVersion)) {
    return { ...base, status: 'rejected', reason: 'version_not_greater' };
  }

  if (item.entity_type === 'groups') {
    store.upsert('groups', groupRow(item));
    return { ...base, status: 'accepted' };
  }

  if (item.entity_type === 'members') {
    store.upsert('members', memberRow(item, groupId));
    return { ...base, status: 'accepted' };
  }

  if (item.entity_type === 'expenses') {
    const row = expenseRow(item, groupId);
    if (!row.payer_member_id) {
      return { ...base, status: 'error', reason: 'invalid_expense' };
    }
    if (!Number.isInteger(row.amount_cents) || row.amount_cents <= 0) {
      return { ...base, status: 'error', reason: 'invalid_amount' };
    }
    if (!store.getMember(row.payer_member_id)) {
      return { ...base, status: 'rejected', reason: 'payer_not_in_group' };
    }
    store.upsert('expenses', row);
    return { ...base, status: 'accepted' };
  }

  const row = bindRow(item, groupId);
  if (!row.device_user_id || !row.member_id) {
    return { ...base, status: 'error', reason: 'invalid_bind' };
  }
  if (!store.getMember(row.member_id)) {
    return { ...base, status: 'rejected', reason: 'member_not_in_group' };
  }
  store.upsert('binds', row);
  return { ...base, status: 'accepted' };
}
