import { shouldAcceptVersion } from '../../src/domain/version';

export type MergeItem = {
  entity_type: string;
  id: string;
  version: number;
  payload: Record<string, unknown>;
};

/** Server name for the one version rule. Same function the client tests. */
export const shouldAccept = shouldAcceptVersion;

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
    allocations: Array.isArray(item.payload.allocations)
      ? item.payload.allocations
      : [],
    version: item.version,
    updated_at:
      (item.payload.updated_at as string) ?? new Date().toISOString(),
    deleted_at: (item.payload.deleted_at as string | null) ?? null,
  };
}
