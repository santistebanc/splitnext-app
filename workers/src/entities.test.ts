import { describe, expect, it } from 'vitest';
import { activityRow } from './entities';

const expense = {
  id: 'e1',
  group_id: 'g1',
  payer_member_id: 'm1',
  amount_cents: 500,
  description: 'Lunch',
  allocations: [],
  version: 1,
  updated_at: '2026-08-17T12:00:00.000Z',
  deleted_at: null,
};

const payload = {
  group_id: 'g1',
  kind: 'expense_deleted',
  actor_member_id: 'm1',
  expense_id: 'e1',
  member_id: '',
};

describe('activityRow', () => {
  it('round-trips undo_snapshot from an object payload', () => {
    expect(
      activityRow(
        {
          entity_type: 'activities',
          id: 'a1',
          version: 1,
          payload: { ...payload, undo_snapshot: expense },
        },
        'g1',
      ).undo_snapshot,
    ).toEqual(expense);
  });

  it('round-trips undo_snapshot from JSON text', () => {
    expect(
      activityRow(
        {
          entity_type: 'activities',
          id: 'a1',
          version: 1,
          payload: { ...payload, undo_snapshot: JSON.stringify(expense) },
        },
        'g1',
      ).undo_snapshot,
    ).toEqual(expense);
  });

  it('stores null when the snapshot is missing', () => {
    expect(
      activityRow(
        {
          entity_type: 'activities',
          id: 'a1',
          version: 1,
          payload,
        },
        'g1',
      ).undo_snapshot,
    ).toBeNull();
  });
});
