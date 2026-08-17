import { describe, expect, it } from 'vitest';
import type { GroupStore } from '@/src/types/group';
import { normalizePersistedTimestamps } from './timestamps';

const ISO = '2026-08-06T00:29:58.642Z';

const store = (overrides: Partial<GroupStore> = {}): GroupStore => ({
  group: {
    id: 'g1',
    version: 1,
    updated_at: ISO,
    deleted_at: null,
    name: '',
    currency_label: 'EUR',
    is_closed: false,
  },
  members: {},
  binds: {},
  expenses: {},
  activities: {},
  syncStatus: 'local',
  lastError: null,
  queue: [],
  ...overrides,
});

/** What rehydration actually hands back: the same shape, with Dates in it. */
const asPersisted = <T>(entity: T, ...fields: string[]): T => {
  const next = { ...entity } as Record<string, unknown>;
  for (const field of fields) {
    if (typeof next[field] === 'string') next[field] = new Date(next[field] as string);
  }
  return next as T;
};

describe('normalizePersistedTimestamps', () => {
  it('turns a rehydrated Date back into the string it was stored as', () => {
    const dirty = store({ group: asPersisted(store().group, 'updated_at') });

    expect(normalizePersistedTimestamps(dirty).group.updated_at).toBe(ISO);
  });

  it('fixes every entity map, not just the group', () => {
    const member = {
      id: 'm1',
      group_id: 'g1',
      display_name: 'Ana',
      version: 1,
      updated_at: ISO,
      deleted_at: null,
    };
    const expense = {
      id: 'e1',
      group_id: 'g1',
      payer_member_id: 'm1',
      amount_cents: 1000,
      description: 'Taxi',
      allocations: [{ member_id: 'm1', amount_cents: 1000 }],
      version: 1,
      updated_at: ISO,
      deleted_at: ISO,
    };

    const fixed = normalizePersistedTimestamps(
      store({
        members: { m1: asPersisted(member, 'updated_at') },
        expenses: { e1: asPersisted(expense, 'updated_at', 'deleted_at') },
      }),
    );

    expect(fixed.members.m1.updated_at).toBe(ISO);
    expect(fixed.expenses.e1.updated_at).toBe(ISO);
    expect(fixed.expenses.e1.deleted_at).toBe(ISO);
  });

  it('leaves the split untouched while fixing the timestamps around it', () => {
    const allocations = [
      { member_id: 'm1', amount_cents: 334 },
      { member_id: 'm2', amount_cents: 333 },
    ];
    const expense = {
      id: 'e1',
      group_id: 'g1',
      payer_member_id: 'm1',
      amount_cents: 667,
      description: '',
      allocations,
      version: 1,
      updated_at: ISO,
      deleted_at: null,
    };

    const fixed = normalizePersistedTimestamps(
      store({ expenses: { e1: asPersisted(expense, 'updated_at') } }),
    );

    expect(fixed.expenses.e1.allocations).toEqual(allocations);
  });

  it('returns the very same object when there is nothing to fix', () => {
    const clean = store();
    expect(normalizePersistedTimestamps(clean)).toBe(clean);
  });

  it('leaves a null deleted_at alone rather than inventing a date', () => {
    const fixed = normalizePersistedTimestamps(
      store({ group: asPersisted(store().group, 'updated_at') }),
    );
    expect(fixed.group.deleted_at).toBe(null);
  });

  it('produces timestamps a string sort can actually compare', () => {
    const older = '2026-08-05T00:00:00.000Z';
    const expense = (id: string, at: string) => ({
      id,
      group_id: 'g1',
      payer_member_id: 'm1',
      amount_cents: 100,
      description: '',
      allocations: [],
      version: 1,
      updated_at: at,
      deleted_at: null,
    });

    const fixed = normalizePersistedTimestamps(
      store({
        expenses: {
          e1: asPersisted(expense('e1', ISO), 'updated_at'),
          e2: asPersisted(expense('e2', older), 'updated_at'),
        },
      }),
    );

    const sorted = Object.values(fixed.expenses).sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at),
    );
    expect(sorted.map((e) => e.id)).toEqual(['e1', 'e2']);
  });
});
