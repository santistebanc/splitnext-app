import type { SyncError, SyncErrorCode } from '../types/syncError';

export type { SyncError, SyncErrorCode };

export function syncError(
  code: SyncErrorCode,
  detail?: string,
): SyncError {
  return {
    code,
    message: detail && detail.length > 0 ? detail : code,
    at: new Date().toISOString(),
  };
}

/** Success clears; failure keeps the provided error. */
export function errorAfterOutcome(
  outcome: 'success' | 'failure',
  failure: SyncError | null,
): SyncError | null {
  return outcome === 'success' ? null : failure;
}

/** Normalize persisted/legacy lastError shapes into SyncError | null. */
export function coerceSyncError(value: unknown): SyncError | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    return value.length > 0 ? syncError('unknown', value) : null;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'at' in value
  ) {
    const v = value as SyncError;
    return {
      code: v.code,
      message: String(v.message),
      at: String(v.at),
    };
  }
  return null;
}
