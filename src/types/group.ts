import type { EntityType } from '@/src/domain/version';
import type { SyncError } from '@/src/types/syncError';

export type GroupEntity = {
  id: string;
  version: number;
  updated_at: string;
  deleted_at: string | null;
  name: string;
  currency_label: string;
  is_closed: boolean;
};

export type MemberEntity = {
  id: string;
  group_id: string;
  display_name: string;
  version: number;
  updated_at: string;
  deleted_at: string | null;
};

export type BindEntity = {
  id: string;
  group_id: string;
  device_user_id: string;
  member_id: string;
  version: number;
  updated_at: string;
  deleted_at: string | null;
};

export type ExpenseEntity = {
  id: string;
  group_id: string;
  /** The member who paid. Who owes is not modelled yet — allocations come next. */
  payer_member_id: string;
  /** Integer cents. Money is never a float, anywhere. */
  amount_cents: number;
  description: string;
  version: number;
  updated_at: string;
  deleted_at: string | null;
};

export type SyncEntity =
  | GroupEntity
  | MemberEntity
  | BindEntity
  | ExpenseEntity;

export type OutboundItem = {
  entity_type: Extract<EntityType, 'groups' | 'members' | 'binds' | 'expenses'>;
  id: string;
  version: number;
  payload: SyncEntity;
};

export type SyncStatus =
  | 'local'
  | 'creating'
  | 'on_server'
  | 'merging'
  | 'fetched'
  | 'error';

export type GroupStore = {
  group: GroupEntity;
  members: Record<string, MemberEntity>;
  binds: Record<string, BindEntity>;
  expenses: Record<string, ExpenseEntity>;
  syncStatus: SyncStatus;
  /** Typed sync error; may briefly be a legacy string from older persists. */
  lastError: SyncError | string | null;
  queue: OutboundItem[];
};
