import { describe, expect, it } from 'vitest';
import type { ActivityEntity, ExpenseEntity, MemberEntity } from '@/src/types/group';
import { planUndo } from './undo';

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

const bob: MemberEntity = {
  id: 'm2',
  group_id: 'g1',
  display_name: 'Bob',
  version: 1,
  updated_at: '2026-08-01T00:00:00.000Z',
  deleted_at: null,
};

const added: ActivityEntity = {
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
};

const deleted: ActivityEntity = {
  id: 'a3',
  group_id: 'g1',
  kind: 'expense_deleted',
  actor_member_id: 'm1',
  expense_id: 'e1',
  member_id: '',
  version: 1,
  updated_at: '2026-08-17T14:00:00.000Z',
  deleted_at: null,
  undo_snapshot: expense,
};

const kicked: ActivityEntity = {
  id: 'a4',
  group_id: 'g1',
  kind: 'member_kicked',
  actor_member_id: 'm1',
  expense_id: '',
  member_id: 'm2',
  version: 1,
  updated_at: '2026-08-17T15:00:00.000Z',
  deleted_at: null,
  undo_snapshot: bob,
};

describe('planUndo', () => {
  it('tombstones an added expense when versions still match', () => {
    const plan = planUndo({
      activity: added,
      assumedMemberId: 'm1',
      expense,
      at: '2026-08-18T10:00:00.000Z',
    });
    expect(plan?.expense).toMatchObject({
      id: 'e1',
      version: 2,
      deleted_at: '2026-08-18T10:00:00.000Z',
    });
    expect(plan?.activity).toMatchObject({
      id: 'a1',
      version: 2,
      deleted_at: '2026-08-18T10:00:00.000Z',
    });
    expect(plan?.member).toBeUndefined();
  });

  it('restores a deleted expense from the snapshot', () => {
    const tombstoned: ExpenseEntity = {
      ...expense,
      version: 2,
      updated_at: '2026-08-17T14:00:00.000Z',
      deleted_at: '2026-08-17T14:00:00.000Z',
    };
    const plan = planUndo({
      activity: deleted,
      assumedMemberId: 'm1',
      expense: tombstoned,
      at: '2026-08-18T10:00:00.000Z',
    });
    expect(plan?.expense).toMatchObject({
      id: 'e1',
      amount_cents: 1000,
      description: 'Taxi',
      version: 3,
      deleted_at: null,
    });
  });

  it('restores a kicked member from the snapshot', () => {
    const tombstoned: MemberEntity = {
      ...bob,
      version: 2,
      deleted_at: '2026-08-17T15:00:00.000Z',
    };
    const plan = planUndo({
      activity: kicked,
      assumedMemberId: 'm1',
      member: tombstoned,
      at: '2026-08-18T10:00:00.000Z',
    });
    expect(plan?.member).toMatchObject({
      id: 'm2',
      display_name: 'Bob',
      version: 3,
      deleted_at: null,
    });
  });

  it('returns null when the actor is someone else', () => {
    expect(
      planUndo({
        activity: added,
        assumedMemberId: 'm2',
        expense,
        at: '2026-08-18T10:00:00.000Z',
      }),
    ).toBeNull();
  });

  it('returns null when there is no snapshot', () => {
    expect(
      planUndo({
        activity: { ...added, undo_snapshot: undefined },
        assumedMemberId: 'm1',
        expense,
        at: '2026-08-18T10:00:00.000Z',
      }),
    ).toBeNull();
  });

  it('returns null when the add was edited afterwards', () => {
    expect(
      planUndo({
        activity: added,
        assumedMemberId: 'm1',
        expense: { ...expense, version: 2, amount_cents: 2000 },
        at: '2026-08-18T10:00:00.000Z',
      }),
    ).toBeNull();
  });

  it('returns null when the activity is already tombstoned', () => {
    expect(
      planUndo({
        activity: { ...added, deleted_at: '2026-08-18T09:00:00.000Z' },
        assumedMemberId: 'm1',
        expense,
        at: '2026-08-18T10:00:00.000Z',
      }),
    ).toBeNull();
  });
});
