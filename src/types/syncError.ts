export type SyncErrorCode =
  | 'missing_token'
  | 'merge_failed'
  | 'fetch_failed'
  | 'roster_failed'
  | 'wake_failed'
  | 'create_failed'
  | 'already_bound'
  | 'member_missing'
  | 'unknown';

export type SyncError = {
  code: SyncErrorCode;
  message: string;
  at: string;
};
