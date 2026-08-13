import { describe, expect, it } from 'vitest';
import {
  shouldCatchUpOnStatus,
  shouldReplaceSubscription,
} from './wakePolicy';

describe('shouldCatchUpOnStatus', () => {
  it('does not catch up on the first SUBSCRIBED', () => {
    expect(shouldCatchUpOnStatus(null, 'SUBSCRIBED')).toBe(false);
  });

  it('catches up when SUBSCRIBED follows CHANNEL_ERROR', () => {
    expect(shouldCatchUpOnStatus('CHANNEL_ERROR', 'SUBSCRIBED')).toBe(true);
  });

  it('catches up when SUBSCRIBED follows TIMED_OUT', () => {
    expect(shouldCatchUpOnStatus('TIMED_OUT', 'SUBSCRIBED')).toBe(true);
  });

  it('catches up when SUBSCRIBED follows CLOSED', () => {
    expect(shouldCatchUpOnStatus('CLOSED', 'SUBSCRIBED')).toBe(true);
  });

  it('does not catch up on SUBSCRIBED following SUBSCRIBED', () => {
    expect(shouldCatchUpOnStatus('SUBSCRIBED', 'SUBSCRIBED')).toBe(false);
  });

  it('does not catch up when SUBSCRIBED follows a non-drop status', () => {
    expect(shouldCatchUpOnStatus('JOINING', 'SUBSCRIBED')).toBe(false);
  });

  it('does not catch up until the channel is SUBSCRIBED again', () => {
    expect(shouldCatchUpOnStatus('CHANNEL_ERROR', 'CLOSED')).toBe(false);
  });
});

describe('shouldReplaceSubscription', () => {
  it('starts when this device has no channel yet', () => {
    expect(shouldReplaceSubscription(false, undefined)).toBe(true);
  });

  it('keeps a live SUBSCRIBED channel', () => {
    expect(shouldReplaceSubscription(true, 'SUBSCRIBED')).toBe(false);
  });

  it('does not tear down a subscribe still in flight', () => {
    expect(shouldReplaceSubscription(true, undefined)).toBe(false);
    expect(shouldReplaceSubscription(true, null)).toBe(false);
  });

  it('replaces a channel that dropped so the hub can listen', () => {
    expect(shouldReplaceSubscription(true, 'CHANNEL_ERROR')).toBe(true);
    expect(shouldReplaceSubscription(true, 'TIMED_OUT')).toBe(true);
    expect(shouldReplaceSubscription(true, 'CLOSED')).toBe(true);
  });
});
