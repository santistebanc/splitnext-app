import { describe, expect, it } from 'vitest';
import {
  assumedMemberIdFromBinds,
  deviceHasActiveBind,
} from './assumedMember';
import type { BindEntity } from '../types/group';

function bind(
  partial: Partial<BindEntity> & Pick<BindEntity, 'id' | 'member_id'>,
): BindEntity {
  return {
    group_id: 'g1',
    device_user_id: 'd1',
    version: 1,
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    ...partial,
  };
}

describe('assumedMemberIdFromBinds', () => {
  it('returns member_id for this device’s active bind', () => {
    const binds = {
      a: bind({ id: 'a', member_id: 'm1', device_user_id: 'd1' }),
      b: bind({ id: 'b', member_id: 'm2', device_user_id: 'd2' }),
    };
    expect(assumedMemberIdFromBinds(binds, 'd1')).toBe('m1');
  });

  it('ignores soft-deleted binds', () => {
    const binds = {
      a: bind({
        id: 'a',
        member_id: 'm1',
        device_user_id: 'd1',
        deleted_at: '2026-01-02T00:00:00.000Z',
      }),
    };
    expect(assumedMemberIdFromBinds(binds, 'd1')).toBeNull();
  });
});

describe('deviceHasActiveBind', () => {
  it('is true when an active bind exists for the device', () => {
    const binds = {
      a: bind({ id: 'a', member_id: 'm1', device_user_id: 'd1' }),
    };
    expect(deviceHasActiveBind(binds, 'd1')).toBe(true);
    expect(deviceHasActiveBind(binds, 'other')).toBe(false);
  });
});
