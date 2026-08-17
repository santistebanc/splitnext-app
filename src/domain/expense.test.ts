import { describe, expect, it } from 'vitest';
import type { ExpenseEntity } from '@/src/types/group';
import { patchExpense, tombstoneExpense } from './expense';

const live = ['m1', 'm2', 'm3'];

const taxi: ExpenseEntity = {
  id: 'e1',
  group_id: 'g1',
  payer_member_id: 'm1',
  amount_cents: 1000,
  description: 'Taxi',
  allocations: [
    { member_id: 'm1', amount_cents: 334 },
    { member_id: 'm2', amount_cents: 333 },
    { member_id: 'm3', amount_cents: 333 },
  ],
  version: 1,
  updated_at: '2026-08-01T00:00:00.000Z',
  deleted_at: null,
};

const equalLive = live.map((memberId) => ({
  memberId,
  shareUnits: 1,
  fixedCents: null,
}));

describe('patchExpense', () => {
  it('rebuilds an equal split at the next version and keeps id / group / deleted_at', () => {
    expect(
      patchExpense(
        taxi,
        live,
        {
          payerMemberId: 'm1',
          amountCents: 2000,
          description: 'Taxi',
          splitAmong: equalLive,
        },
        '2026-08-17T12:00:00.000Z',
      ),
    ).toEqual({
      id: 'e1',
      group_id: 'g1',
      payer_member_id: 'm1',
      amount_cents: 2000,
      description: 'Taxi',
      allocations: [
        {
          member_id: 'm1',
          amount_cents: 667,
          share_units: 1,
          fixed_cents: null,
        },
        {
          member_id: 'm2',
          amount_cents: 667,
          share_units: 1,
          fixed_cents: null,
        },
        {
          member_id: 'm3',
          amount_cents: 666,
          share_units: 1,
          fixed_cents: null,
        },
      ],
      version: 2,
      updated_at: '2026-08-17T12:00:00.000Z',
      deleted_at: null,
    });
  });

  it('rebuilds a mixed split from share units and fixed cents', () => {
    expect(
      patchExpense(
        taxi,
        live,
        {
          payerMemberId: 'm1',
          amountCents: 1000,
          description: 'Taxi',
          splitAmong: [
            { memberId: 'm1', shareUnits: 2, fixedCents: null },
            { memberId: 'm2', shareUnits: 1, fixedCents: null },
            { memberId: 'm3', shareUnits: 0, fixedCents: 200 },
          ],
        },
        '2026-08-17T12:00:00.000Z',
      )?.allocations,
    ).toEqual([
      {
        member_id: 'm1',
        amount_cents: 533,
        share_units: 2,
        fixed_cents: null,
      },
      {
        member_id: 'm2',
        amount_cents: 267,
        share_units: 1,
        fixed_cents: null,
      },
      {
        member_id: 'm3',
        amount_cents: 200,
        share_units: 1,
        fixed_cents: 200,
      },
    ]);
  });

  it('returns null when the trimmed fields and split intent are unchanged', () => {
    expect(
      patchExpense(
        taxi,
        live,
        {
          payerMemberId: 'm1',
          amountCents: 1000,
          description: '  Taxi  ',
          splitAmong: [
            { memberId: 'm3', shareUnits: 1, fixedCents: null },
            { memberId: 'm1', shareUnits: 1, fixedCents: null },
            { memberId: 'm2', shareUnits: 1, fixedCents: null },
          ],
        },
        '2026-08-17T12:00:00.000Z',
      ),
    ).toBeNull();
  });

  it('returns null when the share set is empty or names a missing member', () => {
    const body = {
      payerMemberId: 'm1',
      amountCents: 1000,
      description: 'Taxi',
    };
    expect(
      patchExpense(taxi, live, { ...body, splitAmong: [] }, '2026-08-17T12:00:00.000Z'),
    ).toBeNull();
    expect(
      patchExpense(
        taxi,
        live,
        {
          ...body,
          splitAmong: [
            { memberId: 'm1', shareUnits: 1, fixedCents: null },
            { memberId: 'gone', shareUnits: 1, fixedCents: null },
          ],
        },
        '2026-08-17T12:00:00.000Z',
      ),
    ).toBeNull();
  });

  it('returns null for a non-positive amount or a payer who is not live', () => {
    const body = {
      payerMemberId: 'm1',
      description: 'Taxi',
      splitAmong: equalLive,
    };
    expect(
      patchExpense(
        taxi,
        live,
        { ...body, amountCents: 0 },
        '2026-08-17T12:00:00.000Z',
      ),
    ).toBeNull();
    expect(
      patchExpense(
        taxi,
        live,
        { ...body, amountCents: 1000, payerMemberId: 'gone' },
        '2026-08-17T12:00:00.000Z',
      ),
    ).toBeNull();
  });
});

describe('tombstoneExpense', () => {
  it('soft-deletes a live expense at the next version', () => {
    expect(tombstoneExpense(taxi, '2026-08-17T12:00:00.000Z')).toEqual({
      ...taxi,
      version: 2,
      updated_at: '2026-08-17T12:00:00.000Z',
      deleted_at: '2026-08-17T12:00:00.000Z',
    });
  });

  it('returns null when the expense is already tombstoned', () => {
    const gone = { ...taxi, deleted_at: '2026-08-02T00:00:00.000Z' };
    expect(tombstoneExpense(gone, '2026-08-17T12:00:00.000Z')).toBeNull();
  });
});
