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

/** One member's share of one expense. Integer cents, like all money here. */
export type Allocation = {
  member_id: string;
  amount_cents: number;
  /** Share weight; omitted on expenses recorded before mixed splits. */
  share_units?: number;
  /** Fixed cents; omitted or null when this member is on shares. */
  fixed_cents?: number | null;
};

export type ExpenseEntity = {
  id: string;
  group_id: string;
  /** The member who paid. */
  payer_member_id: string;
  /** Integer cents. Money is never a float, anywhere. */
  amount_cents: number;
  description: string;
  /**
   * Who owes, and how much. Carried inside the expense rather than as child
   * rows so one version number covers the whole split: a merge can never
   * accept a new amount while rejecting one of its shares. Optional because
   * expenses recorded before splits existed — persisted locally, or pulled
   * from a row written before the migration — carry no split at all; every
   * expense written from here on has one.
   */
  allocations?: Allocation[];
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
