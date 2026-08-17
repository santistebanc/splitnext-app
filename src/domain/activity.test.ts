import { describe, expect, it } from 'vitest';
import type { ExpenseEntity, MemberEntity } from '@/src/types/group';
import {
  activityForExpenseAdded,
  formatActivityLine,
  sortActivities,
} from './activity';

const expense: ExpenseEntity = {
  id: 'e1',
  group_id: 'g1',
  payer_member_id: 'm1',
  amount_cents: 1000,
  description: 'Taxi',
  version: 1,
  updated_at: '2026-08-17T12:00:00.000Z',
  deleted_at: null,
};

const ana: MemberEntity = {
  id: 'm1',
  group_id: 'g1',
  display_name: 'Ana',
  version: 1,
  updated_at: '2026-08-01T00:00:00.000Z',
  deleted_at: null,
};

describe('activityForExpenseAdded', () => {
  it('creates a version-1 expense_added event', () => {
    expect(
      activityForExpenseAdded({
        id: 'a1',
        groupId: 'g1',
        actorMemberId: 'm1',
        expense,
        at: '2026-08-17T12:00:00.000Z',
      }),
    ).toEqual({
      id: 'a1',
      group_id: 'g1',
      kind: 'expense_added',
      actor_member_id: 'm1',
      expense_id: 'e1',
      version: 1,
      updated_at: '2026-08-17T12:00:00.000Z',
      deleted_at: null,
    });
  });

  it('returns null when the actor is missing', () => {
    expect(
      activityForExpenseAdded({
        id: 'a1',
        groupId: 'g1',
        actorMemberId: '',
        expense,
        at: '2026-08-17T12:00:00.000Z',
      }),
    ).toBeNull();
  });

  it('returns null when the expense group mismatches', () => {
    expect(
      activityForExpenseAdded({
        id: 'a1',
        groupId: 'g1',
        actorMemberId: 'm1',
        expense: { ...expense, group_id: 'g2' },
        at: '2026-08-17T12:00:00.000Z',
      }),
    ).toBeNull();
  });
});

describe('formatActivityLine', () => {
  it('labels the assumed member as You', () => {
    expect(
      formatActivityLine(
        {
          id: 'a1',
          group_id: 'g1',
          kind: 'expense_added',
          actor_member_id: 'm1',
          expense_id: 'e1',
          version: 1,
          updated_at: '2026-08-17T12:00:00.000Z',
          deleted_at: null,
        },
        { m1: ana },
        { e1: expense },
        'EUR',
        'm1',
      ),
    ).toEqual({
      who: 'You',
      description: 'Taxi',
      amount: '10.00 €',
    });
  });

  it('returns null when the expense is tombstoned', () => {
    expect(
      formatActivityLine(
        {
          id: 'a1',
          group_id: 'g1',
          kind: 'expense_added',
          actor_member_id: 'm1',
          expense_id: 'e1',
          version: 1,
          updated_at: '2026-08-17T12:00:00.000Z',
          deleted_at: null,
        },
        { m1: ana },
        { e1: { ...expense, deleted_at: '2026-08-18T00:00:00.000Z' } },
        'EUR',
        'm1',
      ),
    ).toBeNull();
  });
});

describe('sortActivities', () => {
  it('orders live events newest first', () => {
    const sorted = sortActivities({
      old: {
        id: 'a-old',
        group_id: 'g1',
        kind: 'expense_added',
        actor_member_id: 'm1',
        expense_id: 'e1',
        version: 1,
        updated_at: '2026-08-16T12:00:00.000Z',
        deleted_at: null,
      },
      new: {
        id: 'a-new',
        group_id: 'g1',
        kind: 'expense_added',
        actor_member_id: 'm1',
        expense_id: 'e2',
        version: 1,
        updated_at: '2026-08-17T12:00:00.000Z',
        deleted_at: null,
      },
      gone: {
        id: 'a-gone',
        group_id: 'g1',
        kind: 'expense_added',
        actor_member_id: 'm1',
        expense_id: 'e3',
        version: 1,
        updated_at: '2026-08-18T12:00:00.000Z',
        deleted_at: '2026-08-18T12:00:00.000Z',
      },
    });
    expect(sorted.map((a) => a.id)).toEqual(['a-new', 'a-old']);
  });
});
