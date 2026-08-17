import { describe, expect, it } from 'vitest';
import { mergeOne, type GroupStore } from './merge';
import type { MergeItem } from './entities';

function memoryStore(): GroupStore & {
  rows: Record<string, Record<string, Record<string, unknown>>>;
} {
  const rows: Record<string, Record<string, Record<string, unknown>>> = {
    groups: {},
    members: {},
    binds: {},
    expenses: {},
    activities: {},
  };
  return {
    rows,
    getVersion(entityType, id) {
      const row = rows[entityType]?.[id];
      return row ? (row.version as number) : -1;
    },
    getMember(id) {
      const row = rows.members[id];
      return row ? { id: row.id as string } : null;
    },
    getExpense(id) {
      const row = rows.expenses[id];
      return row ? { id: row.id as string } : null;
    },
    upsert(entityType, row) {
      rows[entityType][row.id as string] = row;
    },
  };
}

const groupItem = (version: number): MergeItem => ({
  entity_type: 'groups',
  id: 'g1',
  version,
  payload: { name: 'trip', currency_label: 'EUR', is_closed: false },
});

describe('mergeOne', () => {
  it('accepts a first version of a group', () => {
    const store = memoryStore();
    expect(mergeOne(store, 'g1', groupItem(1)).status).toBe('accepted');
    expect(store.rows.groups.g1.version).toBe(1);
  });

  it('rejects when the incoming version is not strictly greater', () => {
    const store = memoryStore();
    mergeOne(store, 'g1', groupItem(1));
    expect(mergeOne(store, 'g1', groupItem(1))).toEqual({
      id: 'g1',
      entity_type: 'groups',
      version: 1,
      status: 'rejected',
      reason: 'version_not_greater',
    });
  });

  it('accepts a newer version of the same group', () => {
    const store = memoryStore();
    mergeOne(store, 'g1', groupItem(1));
    expect(mergeOne(store, 'g1', groupItem(2)).status).toBe('accepted');
    expect(store.rows.groups.g1.version).toBe(2);
  });

  it('rejects an expense whose payer is not in the group', () => {
    const store = memoryStore();
    const result = mergeOne(store, 'g1', {
      entity_type: 'expenses',
      id: 'e1',
      version: 1,
      payload: {
        group_id: 'g1',
        payer_member_id: 'm-missing',
        amount_cents: 100,
        description: 'x',
        allocations: [],
      },
    });
    expect(result).toEqual({
      id: 'e1',
      entity_type: 'expenses',
      version: 1,
      status: 'rejected',
      reason: 'payer_not_in_group',
    });
  });

  it('rejects a bind whose member is not in the group', () => {
    const store = memoryStore();
    const result = mergeOne(store, 'g1', {
      entity_type: 'binds',
      id: 'b1',
      version: 1,
      payload: {
        group_id: 'g1',
        device_user_id: 'd1',
        member_id: 'm-missing',
      },
    });
    expect(result.status).toBe('rejected');
    expect(result.reason).toBe('member_not_in_group');
  });

  it('errors on a non-integer amount', () => {
    const store = memoryStore();
    store.upsert('members', { id: 'm1' });
    const result = mergeOne(store, 'g1', {
      entity_type: 'expenses',
      id: 'e1',
      version: 1,
      payload: {
        group_id: 'g1',
        payer_member_id: 'm1',
        amount_cents: 1.5,
        description: 'x',
      },
    });
    expect(result.reason).toBe('invalid_amount');
  });

  it('accepts an activity when the actor and expense exist', () => {
    const store = memoryStore();
    store.upsert('members', { id: 'm1' });
    store.upsert('expenses', { id: 'e1', payer_member_id: 'm1', amount_cents: 100 });
    const result = mergeOne(store, 'g1', {
      entity_type: 'activities',
      id: 'a1',
      version: 1,
      payload: {
        group_id: 'g1',
        kind: 'expense_added',
        actor_member_id: 'm1',
        expense_id: 'e1',
      },
    });
    expect(result.status).toBe('accepted');
    expect(store.rows.activities.a1.kind).toBe('expense_added');
  });

  it('rejects an activity when the expense is missing', () => {
    const store = memoryStore();
    store.upsert('members', { id: 'm1' });
    const result = mergeOne(store, 'g1', {
      entity_type: 'activities',
      id: 'a1',
      version: 1,
      payload: {
        group_id: 'g1',
        kind: 'expense_added',
        actor_member_id: 'm1',
        expense_id: 'e-missing',
      },
    });
    expect(result.reason).toBe('expense_not_in_group');
  });
});
