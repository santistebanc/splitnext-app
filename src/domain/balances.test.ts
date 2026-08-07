import { describe, expect, it } from 'vitest';
import type { Allocation, ExpenseEntity, MemberEntity } from '@/src/types/group';
import { computeBalances } from './balances';

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
});

const roster = (...ids: string[]) =>
  Object.fromEntries(ids.map((id) => [id, member(id)]));

const ledger = (...items: ExpenseEntity[]) =>
  Object.fromEntries(items.map((e) => [e.id, e]));

describe('computeBalances', () => {
  it('credits the payer and debits everyone their share', () => {
    const balances = computeBalances(
      roster('a', 'b', 'c'),
      ledger(
        expense('e1', 'a', 900, [
          { member_id: 'a', amount_cents: 300 },
          { member_id: 'b', amount_cents: 300 },
          { member_id: 'c', amount_cents: 300 },
        ]),
      ),
    );

    expect(balances).toEqual([
      { member_id: 'b', display_name: 'b', net_cents: -300 },
      { member_id: 'c', display_name: 'c', net_cents: -300 },
      { member_id: 'a', display_name: 'a', net_cents: 600 },
    ]);
  });

  it('always nets to zero across the group', () => {
    const balances = computeBalances(
      roster('a', 'b', 'c'),
      ledger(
        expense('e1', 'a', 1000, [
          { member_id: 'a', amount_cents: 334 },
          { member_id: 'b', amount_cents: 333 },
          { member_id: 'c', amount_cents: 333 },
        ]),
        expense('e2', 'b', 500, [
          { member_id: 'a', amount_cents: 167 },
          { member_id: 'b', amount_cents: 167 },
          { member_id: 'c', amount_cents: 166 },
        ]),
      ),
    );

    expect(balances.reduce((t, b) => t + b.net_cents, 0)).toBe(0);
  });

  it('sorts most-negative first, then by name so the order never jitters', () => {
    const balances = computeBalances(
      roster('a', 'b', 'c'),
      ledger(
        expense('e1', 'a', 600, [
          { member_id: 'b', amount_cents: 300 },
          { member_id: 'c', amount_cents: 300 },
        ]),
      ),
    );

    expect(balances.map((b) => b.member_id)).toEqual(['b', 'c', 'a']);
  });

  it('lists a member with no expenses at zero', () => {
    expect(computeBalances(roster('a'), {})).toEqual([
      { member_id: 'a', display_name: 'a', net_cents: 0 },
    ]);
  });

  it('ignores deleted expenses', () => {
    const deleted = {
      ...expense('e1', 'a', 900, [
        { member_id: 'a', amount_cents: 450 },
        { member_id: 'b', amount_cents: 450 },
      ]),
      deleted_at: '2026-08-06T01:00:00.000Z',
    };

    expect(
      computeBalances(roster('a', 'b'), ledger(deleted)).every(
        (b) => b.net_cents === 0,
      ),
    ).toBe(true);
  });

  it('drops deleted members from the list but keeps the group at zero', () => {
    const members = { ...roster('a', 'b'), gone: { ...member('gone'), deleted_at: '2026-08-06T01:00:00.000Z' } };
    const balances = computeBalances(
      members,
      ledger(
        expense('e1', 'a', 900, [
          { member_id: 'a', amount_cents: 300 },
          { member_id: 'b', amount_cents: 300 },
          { member_id: 'gone', amount_cents: 300 },
        ]),
      ),
    );

    expect(balances.map((b) => b.member_id)).toEqual(['b', 'a']);
    expect(balances.find((b) => b.member_id === 'a')?.net_cents).toBe(600);
  });

  it('credits the payer only when an expense carries no allocations', () => {
    const balances = computeBalances(
      roster('a', 'b'),
      ledger(expense('legacy', 'a', 900, [])),
    );

    expect(balances).toEqual([
      { member_id: 'b', display_name: 'b', net_cents: 0 },
      { member_id: 'a', display_name: 'a', net_cents: 900 },
    ]);
  });

  it('ignores an allocation pointing at a member the roster has never seen', () => {
    const balances = computeBalances(
      roster('a'),
      ledger(
        expense('e1', 'a', 600, [
          { member_id: 'a', amount_cents: 300 },
          { member_id: 'ghost', amount_cents: 300 },
        ]),
      ),
    );

    expect(balances).toEqual([
      { member_id: 'a', display_name: 'a', net_cents: 300 },
    ]);
  });
});
