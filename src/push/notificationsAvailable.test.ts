import { describe, expect, it } from 'vitest';
import { notificationsAvailable } from './notificationsAvailable';

describe('notificationsAvailable', () => {
  it('is false in Expo Go', () => {
    expect(notificationsAvailable('expo')).toBe(false);
  });

  it('is true in a standalone or missing ownership', () => {
    expect(notificationsAvailable('standalone')).toBe(true);
    expect(notificationsAvailable(null)).toBe(true);
    expect(notificationsAvailable(undefined)).toBe(true);
  });
});
