export type SyncErrorCode =
  | 'missing_token'
  | 'merge_failed'
  | 'fetch_failed'
  | 'roster_failed'
  | 'wake_failed'
  | 'create_failed'
  | 'binding_closed'
  | 'binding_locked'
  | 'member_missing'
  | 'invite_failed'
  | 'leave_failed'
  | 'unknown';

export type SyncError = {
  code: SyncErrorCode;
  message: string;
  at: string;
};
