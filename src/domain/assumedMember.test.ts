import { describe, expect, it } from 'vitest';
import {
  assumedMemberIdFromBinds,
  bindingIsOpen,
} from './assumedMember';
import type { BindEntity, ExpenseEntity } from '../types/group';

function expense(
  partial: Partial<ExpenseEntity> & Pick<ExpenseEntity, 'id'>,
): ExpenseEntity {
  return {
    group_id: 'g1',
    payer_member_id: 'm1',
    amount_cents: 100,
    description: '',
    allocations: [],
    version: 1,
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    ...partial,
  };
}

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

describe('bindingIsOpen', () => {
  it('is open while the group has no expenses', () => {
    expect(bindingIsOpen({})).toBe(true);
  });

  it('closes as soon as one expense exists', () => {
    expect(bindingIsOpen({ e: expense({ id: 'e' }) })).toBe(false);
  });

  it('a soft-deleted expense does not close it', () => {
    const expenses = {
      e: expense({ id: 'e', deleted_at: '2026-01-02T00:00:00.000Z' }),
    };
    expect(bindingIsOpen(expenses)).toBe(true);
  });

  it('one live expense among tombstones still closes it', () => {
    const expenses = {
      e: expense({ id: 'e', deleted_at: '2026-01-02T00:00:00.000Z' }),
      f: expense({ id: 'f' }),
    };
    expect(bindingIsOpen(expenses)).toBe(false);
  });
});
