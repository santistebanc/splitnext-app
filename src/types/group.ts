import type { EntityType } from '@/src/domain/version';

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

export type SyncEntity = GroupEntity | MemberEntity | BindEntity;

export type OutboundItem = {
  entity_type: Extract<EntityType, 'groups' | 'members' | 'binds'>;
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
  syncStatus: SyncStatus;
  lastError: string | null;
  queue: OutboundItem[];
};
