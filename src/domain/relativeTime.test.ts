import { describe, expect, it } from 'vitest';
import { relativeTimeLabel } from './relativeTime';

const now = new Date('2026-08-18T12:00:00.000Z');

describe('relativeTimeLabel', () => {
  it('returns just now for the last few seconds', () => {
    expect(relativeTimeLabel('2026-08-18T11:59:30.000Z', now)).toBe('just now');
  });

  it('returns minutes ago within the hour', () => {
    expect(relativeTimeLabel('2026-08-18T11:55:00.000Z', now)).toBe('5m ago');
  });

  it('returns hours ago within the day', () => {
    expect(relativeTimeLabel('2026-08-18T09:00:00.000Z', now)).toBe('3h ago');
  });

  it('returns days ago within the week', () => {
    expect(relativeTimeLabel('2026-08-16T12:00:00.000Z', now)).toBe('2d ago');
  });

  it('returns a short date when older than a week', () => {
    expect(relativeTimeLabel('2026-08-01T12:00:00.000Z', now)).toBe('Aug 1');
  });
});
