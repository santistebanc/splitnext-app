export type GroupEntity = {
  id: string;
  version: number;
  updated_at: string;
  deleted_at: string | null;
  name: string;
  currency_label: string;
  is_closed: boolean;
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
  syncStatus: SyncStatus;
  lastError: string | null;
  queue: Array<{
    entity_type: 'groups';
    id: string;
    version: number;
    payload: GroupEntity;
  }>;
};
