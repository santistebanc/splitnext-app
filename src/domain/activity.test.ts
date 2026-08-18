import { describe, expect, it } from 'vitest';
import type { ActivityEntity, ExpenseEntity, MemberEntity } from '@/src/types/group';
import {
  activityForExpenseAdded,
  activityForExpenseDeleted,
  activityForExpenseEdited,
  activityForMemberKicked,
  activityForMemberRenamed,
  activitiesFromOthers,
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

const bob: MemberEntity = {
  id: 'm2',
  group_id: 'g1',
  display_name: 'Bob',
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
      member_id: '',
      version: 1,
      updated_at: '2026-08-17T12:00:00.000Z',
      deleted_at: null,
    });
  });

  it('carries the live expense as undo_snapshot when given', () => {
    expect(
      activityForExpenseAdded({
        id: 'a1',
        groupId: 'g1',
        actorMemberId: 'm1',
        expense,
        at: '2026-08-17T12:00:00.000Z',
        snapshot: expense,
      })?.undo_snapshot,
    ).toEqual(expense);
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

describe('activityForExpenseEdited', () => {
  it('creates an expense_edited event', () => {
    expect(
      activityForExpenseEdited({
        id: 'a2',
        groupId: 'g1',
        actorMemberId: 'm1',
        expense,
        at: '2026-08-17T13:00:00.000Z',
      })?.kind,
    ).toBe('expense_edited');
  });
});

describe('activityForExpenseDeleted', () => {
  it('creates an expense_deleted event', () => {
    expect(
      activityForExpenseDeleted({
        id: 'a3',
        groupId: 'g1',
        actorMemberId: 'm1',
        expense,
        at: '2026-08-17T14:00:00.000Z',
      })?.kind,
    ).toBe('expense_deleted');
  });

  it('carries the live expense as undo_snapshot', () => {
    expect(
      activityForExpenseDeleted({
        id: 'a3',
        groupId: 'g1',
        actorMemberId: 'm1',
        expense,
        at: '2026-08-17T14:00:00.000Z',
        snapshot: expense,
      })?.undo_snapshot,
    ).toEqual(expense);
  });
});

describe('activityForMemberKicked', () => {
  it('creates a member_kicked event', () => {
    expect(
      activityForMemberKicked({
        id: 'a4',
        groupId: 'g1',
        actorMemberId: 'm1',
        member: bob,
        at: '2026-08-17T15:00:00.000Z',
      }),
    ).toEqual({
      id: 'a4',
      group_id: 'g1',
      kind: 'member_kicked',
      actor_member_id: 'm1',
      expense_id: '',
      member_id: 'm2',
      version: 1,
      updated_at: '2026-08-17T15:00:00.000Z',
      deleted_at: null,
    });
  });
});

describe('activityForMemberRenamed', () => {
  it('creates a member_renamed event', () => {
    expect(
      activityForMemberRenamed({
        id: 'a5',
        groupId: 'g1',
        actorMemberId: 'm1',
        member: bob,
        at: '2026-08-17T16:00:00.000Z',
      })?.kind,
    ).toBe('member_renamed');
  });
});

describe('formatActivityLine', () => {
  it('labels the assumed member as You for expense_added', () => {
    expect(
      formatActivityLine(
        {
          id: 'a1',
          group_id: 'g1',
          kind: 'expense_added',
          actor_member_id: 'm1',
          expense_id: 'e1',
          member_id: '',
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
      id: 'a1',
      kind: 'expense_added',
      who: 'You',
      description: 'Taxi',
      amount: '10.00 €',
      at: '2026-08-17T12:00:00.000Z',
      canUndo: false,
    });
  });

  it('marks canUndo when this device is the actor and the snapshot still matches', () => {
    expect(
      formatActivityLine(
        {
          id: 'a1',
          group_id: 'g1',
          kind: 'expense_added',
          actor_member_id: 'm1',
          expense_id: 'e1',
          member_id: '',
          version: 1,
          updated_at: '2026-08-17T12:00:00.000Z',
          deleted_at: null,
          undo_snapshot: expense,
        },
        { m1: ana },
        { e1: expense },
        'EUR',
        'm1',
      )?.canUndo,
    ).toBe(true);
  });

  it('hides undo when the expense was edited after the add', () => {
    expect(
      formatActivityLine(
        {
          id: 'a1',
          group_id: 'g1',
          kind: 'expense_added',
          actor_member_id: 'm1',
          expense_id: 'e1',
          member_id: '',
          version: 1,
          updated_at: '2026-08-17T12:00:00.000Z',
          deleted_at: null,
          undo_snapshot: expense,
        },
        { m1: ana },
        { e1: { ...expense, version: 2 } },
        'EUR',
        'm1',
      )?.canUndo,
    ).toBe(false);
  });

  it('returns null when the expense is tombstoned for expense_added', () => {
    expect(
      formatActivityLine(
        {
          id: 'a1',
          group_id: 'g1',
          kind: 'expense_added',
          actor_member_id: 'm1',
          expense_id: 'e1',
          member_id: '',
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

  it('still formats expense_deleted when the expense is tombstoned', () => {
    expect(
      formatActivityLine(
        {
          id: 'a1',
          group_id: 'g1',
          kind: 'expense_deleted',
          actor_member_id: 'm1',
          expense_id: 'e1',
          member_id: '',
          version: 1,
          updated_at: '2026-08-17T12:00:00.000Z',
          deleted_at: null,
        },
        { m1: ana },
        { e1: { ...expense, deleted_at: '2026-08-18T00:00:00.000Z' } },
        'EUR',
        'm1',
      ),
    ).toEqual({
      id: 'a1',
      kind: 'expense_deleted',
      who: 'You',
      description: 'Taxi',
      amount: '10.00 €',
      at: '2026-08-17T12:00:00.000Z',
      canUndo: false,
    });
  });

  it('formats member_kicked for a tombstoned member', () => {
    expect(
      formatActivityLine(
        {
          id: 'a1',
          group_id: 'g1',
          kind: 'member_kicked',
          actor_member_id: 'm1',
          expense_id: '',
          member_id: 'm2',
          version: 1,
          updated_at: '2026-08-17T12:00:00.000Z',
          deleted_at: null,
        },
        { m1: ana, m2: { ...bob, deleted_at: '2026-08-18T00:00:00.000Z' } },
        {},
        'EUR',
        'm1',
      ),
    ).toEqual({
      id: 'a1',
      kind: 'member_kicked',
      who: 'You',
      description: 'Bob',
      at: '2026-08-17T12:00:00.000Z',
      canUndo: false,
    });
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
        member_id: '',
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
        member_id: '',
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
        member_id: '',
        version: 1,
        updated_at: '2026-08-18T12:00:00.000Z',
        deleted_at: '2026-08-18T12:00:00.000Z',
      },
    });
    expect(sorted.map((a) => a.id)).toEqual(['a-new', 'a-old']);
  });
});

const activity = (
  id: string,
  actorId: string,
  expenseId: string,
  at: string,
): ActivityEntity => ({
  id,
  group_id: 'g1',
  kind: 'expense_added',
  actor_member_id: actorId,
  expense_id: expenseId,
  member_id: '',
  version: 1,
  updated_at: at,
  deleted_at: null,
});

describe('activitiesFromOthers', () => {
  it('returns empty when there is no assumed member', () => {
    expect(
      activitiesFromOthers(
        {},
        { a1: activity('a1', 'm2', 'e1', '2026-08-17T12:00:00.000Z') },
        null,
      ),
    ).toEqual([]);
  });

  it('excludes activities from this device', () => {
    expect(
      activitiesFromOthers(
        {},
        { a1: activity('a1', 'm1', 'e1', '2026-08-17T12:00:00.000Z') },
        'm1',
      ),
    ).toEqual([]);
  });

  it('returns only activities that were not in the before snapshot', () => {
    const before = { a1: activity('a1', 'm2', 'e1', '2026-08-16T12:00:00.000Z') };
    const after = {
      ...before,
      a2: activity('a2', 'm2', 'e2', '2026-08-17T12:00:00.000Z'),
    };
    expect(activitiesFromOthers(before, after, 'm1').map((a) => a.id)).toEqual([
      'a2',
    ]);
  });

  it('orders multiple new foreign activities newest first', () => {
    const after = {
      a1: activity('a1', 'm2', 'e1', '2026-08-16T12:00:00.000Z'),
      a2: activity('a2', 'm2', 'e2', '2026-08-18T12:00:00.000Z'),
    };
    expect(activitiesFromOthers({}, after, 'm1').map((a) => a.id)).toEqual([
      'a2',
      'a1',
    ]);
  });
});
