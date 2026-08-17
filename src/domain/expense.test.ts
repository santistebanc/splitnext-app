import { describe, expect, it } from 'vitest';
import type { ExpenseEntity } from '@/src/types/group';
import { patchExpense } from './expense';

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
          participantMemberIds: live,
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
        { member_id: 'm1', amount_cents: 667 },
        { member_id: 'm2', amount_cents: 667 },
        { member_id: 'm3', amount_cents: 666 },
      ],
      version: 2,
      updated_at: '2026-08-17T12:00:00.000Z',
      deleted_at: null,
    });
  });

  it('returns null when the trimmed fields are unchanged', () => {
    expect(
      patchExpense(
        taxi,
        live,
        {
          payerMemberId: 'm1',
          amountCents: 1000,
          description: '  Taxi  ',
          participantMemberIds: ['m3', 'm1', 'm2'],
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
      patchExpense(
        taxi,
        live,
        { ...body, participantMemberIds: [] },
        '2026-08-17T12:00:00.000Z',
      ),
    ).toBeNull();
    expect(
      patchExpense(
        taxi,
        live,
        { ...body, participantMemberIds: ['m1', 'gone'] },
        '2026-08-17T12:00:00.000Z',
      ),
    ).toBeNull();
  });

  it('returns null for a non-positive amount or a payer who is not live', () => {
    const body = {
      payerMemberId: 'm1',
      description: 'Taxi',
      participantMemberIds: live,
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
