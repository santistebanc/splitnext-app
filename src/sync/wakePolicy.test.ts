import { describe, expect, it } from 'vitest';
import { shouldCatchUpOnStatus } from './wakePolicy';

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
