import { describe, expect, it } from 'vitest';
import type { BindEntity } from '@/src/types/group';
import { bindOnce, tombstoneBind } from './bind';

const live: BindEntity = {
  id: 'b1',
  group_id: 'g1',
  device_user_id: 'd1',
  member_id: 'm1',
  version: 3,
  updated_at: '2026-08-01T00:00:00.000Z',
  deleted_at: null,
};

describe('tombstoneBind', () => {
  it('soft-deletes a live bind at the next version', () => {
    expect(tombstoneBind(live, '2026-08-14T12:00:00.000Z')).toEqual({
      id: 'b1',
      group_id: 'g1',
      device_user_id: 'd1',
      member_id: 'm1',
      version: 4,
      updated_at: '2026-08-14T12:00:00.000Z',
      deleted_at: '2026-08-14T12:00:00.000Z',
    });
  });

  it('returns null when the bind is already tombstoned', () => {
    const gone = { ...live, deleted_at: '2026-08-02T00:00:00.000Z' };
    expect(tombstoneBind(gone, '2026-08-14T12:00:00.000Z')).toBeNull();
  });
});

describe('bindOnce', () => {
  it('allows a first bind when this device has no live bind', () => {
    expect(bindOnce({}, 'd1', 'm1')).toBe('bind');
  });

  it('is a no-op when this device is already that member', () => {
    expect(bindOnce({ b1: live }, 'd1', 'm1')).toBe('noop');
  });

  it('refuses a different member once this device is bound', () => {
    expect(bindOnce({ b1: live }, 'd1', 'm2')).toBe('locked');
  });

  it('ignores a tombstoned bind so the device may bind again', () => {
    const gone = { ...live, deleted_at: '2026-08-02T00:00:00.000Z' };
    expect(bindOnce({ b1: gone }, 'd1', 'm2')).toBe('bind');
  });
});
