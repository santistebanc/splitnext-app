import { describe, expect, it } from 'vitest';
import type { Allocation, ExpenseEntity, MemberEntity } from '@/src/types/group';
import { computeBalances } from './balances';
import { memberBuckets } from './buckets';

const member = (id: string, name = id): MemberEntity => ({
  id,
  group_id: 'g1',
  display_name: name,
  version: 1,
  updated_at: '2026-08-06T00:00:00.000Z',
  deleted_at: null,
});

const expense = (
  id: string,
  payer: string,
  amount: number,
  allocations: Allocation[],
  extra: Partial<ExpenseEntity> = {},
): ExpenseEntity => ({
  id,
  group_id: 'g1',
  payer_member_id: payer,
  amount_cents: amount,
  description: '',
  allocations,
  version: 1,
  updated_at: '2026-08-06T00:00:00.000Z',
  deleted_at: null,
  ...extra,
});

const roster = (...ids: string[]) =>
  Object.fromEntries(ids.map((id) => [id, member(id)]));

const ledger = (...items: ExpenseEntity[]) =>
  Object.fromEntries(items.map((e) => [e.id, e]));

describe('memberBuckets', () => {
  it('gives the payer one paid-for line at the others’ shares on a 3-way split', () => {
    const dinner = expense(
      'e1',
      'a',
      900,
      [
        { member_id: 'a', amount_cents: 300 },
        { member_id: 'b', amount_cents: 300 },
        { member_id: 'c', amount_cents: 300 },
      ],
      { description: 'Dinner' },
    );

    expect(memberBuckets('a', roster('a', 'b', 'c'), ledger(dinner))).toEqual({
      paidFor: [
        {
          expense_id: 'e1',
          description: 'Dinner',
          counterpart_ids: ['b', 'c'],
          amount_cents: 600,
        },
      ],
      owesFor: [],
    });
  });

  it('gives each other member one owe-for line at their share', () => {
    const dinner = expense(
      'e1',
      'a',
      900,
      [
        { member_id: 'a', amount_cents: 300 },
        { member_id: 'b', amount_cents: 300 },
        { member_id: 'c', amount_cents: 300 },
      ],
      { description: 'Dinner' },
    );
    const members = roster('a', 'b', 'c');

    expect(memberBuckets('b', members, ledger(dinner))).toEqual({
      paidFor: [],
      owesFor: [
        {
          expense_id: 'e1',
          description: 'Dinner',
          counterpart_ids: ['a'],
          amount_cents: -300,
        },
      ],
    });
  });

  it('puts the full amount on paid-for when the payer is not in the split', () => {
    const settlement = expense(
      's1',
      'a',
      400,
      [{ member_id: 'b', amount_cents: 400 }],
      { description: 'Settlement' },
    );

    expect(memberBuckets('a', roster('a', 'b'), ledger(settlement))).toEqual({
      paidFor: [
        {
          expense_id: 's1',
          description: 'Settlement',
          counterpart_ids: ['b'],
          amount_cents: 400,
        },
      ],
      owesFor: [],
    });
    expect(memberBuckets('b', roster('a', 'b'), ledger(settlement))).toEqual({
      paidFor: [],
      owesFor: [
        {
          expense_id: 's1',
          description: 'Settlement',
          counterpart_ids: ['a'],
          amount_cents: -400,
        },
      ],
    });
  });

  it('omits a line when the member paid only for themself', () => {
    const solo = expense('e1', 'a', 500, [
      { member_id: 'a', amount_cents: 500 },
    ]);

    expect(memberBuckets('a', roster('a', 'b'), ledger(solo))).toEqual({
      paidFor: [],
      owesFor: [],
    });
  });

  it('credits the payer a paid-for line and nobody an owe-for when there are no allocations', () => {
    const legacy = expense('legacy', 'a', 900, [], { description: 'Old' });

    expect(memberBuckets('a', roster('a', 'b'), ledger(legacy))).toEqual({
      paidFor: [
        {
          expense_id: 'legacy',
          description: 'Old',
          counterpart_ids: [],
          amount_cents: 900,
        },
      ],
      owesFor: [],
    });
    expect(memberBuckets('b', roster('a', 'b'), ledger(legacy))).toEqual({
      paidFor: [],
      owesFor: [],
    });
  });

  it('omits a soft-deleted expense', () => {
    const gone = expense(
      'e1',
      'a',
      900,
      [
        { member_id: 'a', amount_cents: 450 },
        { member_id: 'b', amount_cents: 450 },
      ],
      { deleted_at: '2026-08-06T01:00:00.000Z', description: 'Gone' },
    );

    expect(memberBuckets('a', roster('a', 'b'), ledger(gone))).toEqual({
      paidFor: [],
      owesFor: [],
    });
  });

  it('lists newest expenses first', () => {
    const older = expense(
      'e1',
      'a',
      200,
      [
        { member_id: 'a', amount_cents: 100 },
        { member_id: 'b', amount_cents: 100 },
      ],
      { description: 'Older', updated_at: '2026-08-01T00:00:00.000Z' },
    );
    const newer = expense(
      'e2',
      'a',
      400,
      [
        { member_id: 'a', amount_cents: 200 },
        { member_id: 'b', amount_cents: 200 },
      ],
      { description: 'Newer', updated_at: '2026-08-02T00:00:00.000Z' },
    );

    expect(
      memberBuckets('a', roster('a', 'b'), ledger(older, newer)).paidFor.map(
        (l) => l.expense_id,
      ),
    ).toEqual(['e2', 'e1']);
  });

  it('sums to the same net as computeBalances for that member', () => {
    const members = roster('a', 'b', 'c');
    const expenses = ledger(
      expense('e1', 'a', 900, [
        { member_id: 'a', amount_cents: 300 },
        { member_id: 'b', amount_cents: 300 },
        { member_id: 'c', amount_cents: 300 },
      ]),
      expense('e2', 'b', 500, [
        { member_id: 'a', amount_cents: 167 },
        { member_id: 'b', amount_cents: 167 },
        { member_id: 'c', amount_cents: 166 },
      ]),
      expense('s1', 'c', 100, [{ member_id: 'a', amount_cents: 100 }], {
        description: 'Settlement',
      }),
    );

    const nets = Object.fromEntries(
      computeBalances(members, expenses).map((b) => [b.member_id, b.net_cents]),
    );
    for (const id of ['a', 'b', 'c']) {
      const { paidFor, owesFor } = memberBuckets(id, members, expenses);
      const sum = [...paidFor, ...owesFor].reduce(
        (t, l) => t + l.amount_cents,
        0,
      );
      expect(sum).toBe(nets[id]);
    }
  });

  it('returns empty buckets when the member is not live', () => {
    const dinner = expense(
      'e1',
      'a',
      900,
      [
        { member_id: 'a', amount_cents: 450 },
        { member_id: 'b', amount_cents: 450 },
      ],
      { description: 'Dinner' },
    );

    expect(memberBuckets('ghost', roster('a', 'b'), ledger(dinner))).toEqual({
      paidFor: [],
      owesFor: [],
    });
  });

  it('does not name a deleted counterpart but still counts their share on the payer', () => {
    const members = {
      ...roster('a', 'b'),
      gone: { ...member('gone'), deleted_at: '2026-08-06T01:00:00.000Z' },
    };
    const dinner = expense('e1', 'a', 900, [
      { member_id: 'a', amount_cents: 300 },
      { member_id: 'b', amount_cents: 300 },
      { member_id: 'gone', amount_cents: 300 },
    ]);

    expect(memberBuckets('a', members, ledger(dinner)).paidFor).toEqual([
      {
        expense_id: 'e1',
        description: '',
        counterpart_ids: ['b'],
        amount_cents: 600,
      },
    ]);
  });
});
