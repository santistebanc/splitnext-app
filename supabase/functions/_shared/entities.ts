export type MergeItem = {
  entity_type: string;
  id: string;
  version: number;
  payload: Record<string, unknown>;
};

export function shouldAccept(incoming: number, stored: number): boolean {
  return incoming > stored;
}

export const MEMBER_SELECT =
  'id, group_id, version, updated_at, deleted_at, display_name';
export const BIND_SELECT =
  'id, group_id, device_user_id, member_id, version, updated_at, deleted_at';
export const EXPENSE_SELECT =
  'id, group_id, payer_member_id, amount_cents, description, version, updated_at, deleted_at';
export const GROUP_SELECT =
  'id, version, updated_at, deleted_at, name, currency_label, is_closed';

export function groupRow(item: MergeItem) {
  return {
    id: item.id,
    version: item.version,
    updated_at:
      (item.payload.updated_at as string) ?? new Date().toISOString(),
    deleted_at: (item.payload.deleted_at as string | null) ?? null,
    name: (item.payload.name as string) ?? '',
    currency_label: (item.payload.currency_label as string) ?? 'EUR',
    is_closed: Boolean(item.payload.is_closed),
  };
}

export function memberRow(item: MergeItem, groupId: string) {
  return {
    id: item.id,
    group_id: groupId,
    version: item.version,
    updated_at:
      (item.payload.updated_at as string) ?? new Date().toISOString(),
    deleted_at: (item.payload.deleted_at as string | null) ?? null,
    display_name: (item.payload.display_name as string) ?? '',
  };
}

export function bindRow(item: MergeItem, groupId: string) {
  return {
    id: item.id,
    group_id: groupId,
    device_user_id: String(item.payload.device_user_id ?? ''),
    member_id: String(item.payload.member_id ?? ''),
    version: item.version,
    updated_at:
      (item.payload.updated_at as string) ?? new Date().toISOString(),
    deleted_at: (item.payload.deleted_at as string | null) ?? null,
  };
}

export function expenseRow(item: MergeItem, groupId: string) {
  return {
    id: item.id,
    group_id: groupId,
    payer_member_id: String(item.payload.payer_member_id ?? ''),
    amount_cents: Number(item.payload.amount_cents ?? 0),
    description: (item.payload.description as string) ?? '',
    version: item.version,
    updated_at:
      (item.payload.updated_at as string) ?? new Date().toISOString(),
    deleted_at: (item.payload.deleted_at as string | null) ?? null,
  };
}
