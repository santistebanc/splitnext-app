import { describe, expect, it } from 'vitest';
import {
  nextReconnectDelayMs,
  shouldCatchUpOnStatus,
  shouldReplaceSubscription,
} from './wakePolicy';

describe('shouldCatchUpOnStatus', () => {
  it('does not catch up on the first OPEN', () => {
    expect(shouldCatchUpOnStatus(null, 'OPEN')).toBe(false);
  });

  it('catches up when OPEN follows ERROR', () => {
    expect(shouldCatchUpOnStatus('ERROR', 'OPEN')).toBe(true);
  });

  it('catches up when OPEN follows CLOSED', () => {
    expect(shouldCatchUpOnStatus('CLOSED', 'OPEN')).toBe(true);
  });

  it('does not catch up on OPEN following OPEN', () => {
    expect(shouldCatchUpOnStatus('OPEN', 'OPEN')).toBe(false);
  });

  it('does not catch up when OPEN follows a non-drop status', () => {
    expect(shouldCatchUpOnStatus('CONNECTING', 'OPEN')).toBe(false);
  });

  it('does not catch up until the socket is OPEN again', () => {
    expect(shouldCatchUpOnStatus('ERROR', 'CLOSED')).toBe(false);
  });
});

describe('shouldReplaceSubscription', () => {
  it('starts when this device has no socket yet', () => {
    expect(shouldReplaceSubscription(false, undefined)).toBe(true);
  });

  it('keeps a live OPEN socket', () => {
    expect(shouldReplaceSubscription(true, 'OPEN')).toBe(false);
  });

  it('does not tear down a subscribe still in flight', () => {
    expect(shouldReplaceSubscription(true, undefined)).toBe(false);
    expect(shouldReplaceSubscription(true, null)).toBe(false);
  });

  it('replaces a socket that dropped so the hub can listen', () => {
    expect(shouldReplaceSubscription(true, 'ERROR')).toBe(true);
    expect(shouldReplaceSubscription(true, 'CLOSED')).toBe(true);
  });
});

describe('nextReconnectDelayMs', () => {
  it('starts at one second and doubles each failed attempt', () => {
    expect(nextReconnectDelayMs(0)).toBe(1000);
    expect(nextReconnectDelayMs(1)).toBe(2000);
    expect(nextReconnectDelayMs(2)).toBe(4000);
  });

  it('caps at thirty seconds', () => {
    expect(nextReconnectDelayMs(5)).toBe(30_000);
    expect(nextReconnectDelayMs(20)).toBe(30_000);
  });
});
