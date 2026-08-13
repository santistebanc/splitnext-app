import { describe, expect, it } from 'vitest';
import {
  expensePrefillFromSearchParams,
  settlementHref,
} from './expensePrefill';
import type { Settlement } from './settle';

describe('expensePrefillFromSearchParams', () => {
  it('reads payer, integer-cent amount, participants, and what-for', () => {
    expect(
      expensePrefillFromSearchParams({
        payer: 'cy',
        amount: '334',
        participants: 'ana',
        what: 'Settlement',
      }),
    ).toEqual({
      payerId: 'cy',
      amountCents: 334,
      participantIds: ['ana'],
      what: 'Settlement',
    });
  });

  it('returns null when payer, amount, or participants cannot be used', () => {
    const valid = {
      payer: 'cy',
      amount: '334',
      participants: 'ana',
      what: 'Settlement',
    };
    expect(expensePrefillFromSearchParams({ ...valid, payer: '' })).toBeNull();
    expect(expensePrefillFromSearchParams({ ...valid, amount: '3.34' })).toBeNull();
    expect(expensePrefillFromSearchParams({ ...valid, amount: '0' })).toBeNull();
    expect(expensePrefillFromSearchParams({ ...valid, amount: '-5' })).toBeNull();
    expect(expensePrefillFromSearchParams({ ...valid, participants: '' })).toBeNull();
    expect(expensePrefillFromSearchParams({ ...valid, participants: ',' })).toBeNull();
  });

  it('keeps unique participant ids when the list is messy', () => {
    expect(
      expensePrefillFromSearchParams({
        payer: 'cy',
        amount: '500',
        participants: 'ana,ana, bo',
        what: '',
      }),
    ).toEqual({
      payerId: 'cy',
      amountCents: 500,
      participantIds: ['ana', 'bo'],
      what: '',
    });
  });

  it('treats a missing what-for as empty and still prefills', () => {
    expect(
      expensePrefillFromSearchParams({
        payer: 'cy',
        amount: '334',
        participants: 'ana',
      }),
    ).toEqual({
      payerId: 'cy',
      amountCents: 334,
      participantIds: ['ana'],
      what: '',
    });
  });
});

const transfer: Settlement = {
  from_member_id: 'cy',
  to_member_id: 'ana',
  amount_cents: 334,
  from_display_name: 'Cy',
  to_display_name: 'Ana',
};

describe('settlementHref', () => {
  it('puts integer cents and Settlement on the new-expense path', () => {
    expect(settlementHref('g1', transfer)).toBe(
      '/group/g1/expense/new?payer=cy&amount=334&participants=ana&what=Settlement',
    );
  });

  it('is the same for two devices holding the same settlement', () => {
    expect(settlementHref('g1', transfer)).toBe(
      settlementHref('g1', { ...transfer, from_display_name: 'CY' }),
    );
  });
});
