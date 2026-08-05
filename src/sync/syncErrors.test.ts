import { describe, expect, it } from 'vitest';
import {
  coerceSyncError,
  errorAfterOutcome,
  syncError,
} from './syncErrors';

describe('syncError', () => {
  it('builds a typed error with code, message, and at', () => {
    const err = syncError('merge_failed', 'network down');
    expect(err.code).toBe('merge_failed');
    expect(err.message).toBe('network down');
    expect(err.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('uses the code as message when detail is omitted', () => {
    expect(syncError('missing_token').message).toBe('missing_token');
  });
});

describe('errorAfterOutcome', () => {
  it('clears error on success', () => {
    const prev = syncError('roster_failed', 'boom');
    expect(errorAfterOutcome('success', prev)).toBeNull();
  });

  it('keeps the failure error on failure', () => {
    const failure = syncError('fetch_failed', '404');
    expect(errorAfterOutcome('failure', failure)).toEqual(failure);
  });
});

describe('coerceSyncError', () => {
  it('passes through typed errors', () => {
    const err = syncError('wake_failed');
    expect(coerceSyncError(err)).toEqual(err);
  });

  it('wraps legacy string errors from persisted store', () => {
    const err = coerceSyncError('roster:edge_list-roster_failed_404');
    expect(err?.code).toBe('unknown');
    expect(err?.message).toBe('roster:edge_list-roster_failed_404');
  });

  it('returns null for empty values', () => {
    expect(coerceSyncError(null)).toBeNull();
    expect(coerceSyncError(undefined)).toBeNull();
  });
});
