import { describe, expect, it } from 'vitest';
import {
  assumedMemberIdFromBinds,
  bindingIsOpen,
  memberHasLiveBind,
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

describe('memberHasLiveBind', () => {
  it('is false for a member nobody has claimed', () => {
    const binds = { a: bind({ id: 'a', member_id: 'm1' }) };
    expect(memberHasLiveBind(binds, 'm2')).toBe(false);
  });

  it('is true once some device holds a live bind on them', () => {
    const binds = { a: bind({ id: 'a', member_id: 'm1' }) };
    expect(memberHasLiveBind(binds, 'm1')).toBe(true);
  });

  it('is true regardless of which device holds it', () => {
    const binds = {
      a: bind({ id: 'a', member_id: 'm1', device_user_id: 'someone-else' }),
    };
    expect(memberHasLiveBind(binds, 'm1')).toBe(true);
  });

  it('ignores soft-deleted binds, so a released slot is invitable again', () => {
    const binds = {
      a: bind({
        id: 'a',
        member_id: 'm1',
        deleted_at: '2026-01-02T00:00:00.000Z',
      }),
    };
    expect(memberHasLiveBind(binds, 'm1')).toBe(false);
  });

  it('one live bind among tombstones still counts as claimed', () => {
    const binds = {
      a: bind({
        id: 'a',
        member_id: 'm1',
        deleted_at: '2026-01-02T00:00:00.000Z',
      }),
      b: bind({ id: 'b', member_id: 'm1', device_user_id: 'd2' }),
    };
    expect(memberHasLiveBind(binds, 'm1')).toBe(true);
  });

  it('is false when there are no binds at all', () => {
    expect(memberHasLiveBind({}, 'm1')).toBe(false);
  });
});
