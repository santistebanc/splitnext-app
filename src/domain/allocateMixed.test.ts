import { describe, expect, it } from 'vitest';
import { allocateMixed } from './allocateMixed';

const sum = (rows: { amount_cents: number }[]) =>
  rows.reduce((total, row) => total + row.amount_cents, 0);

describe('allocateMixed', () => {
  it('splits equally and sums to total', () => {
    const rows = allocateMixed(1000, [
      { id: 'a', shareUnits: 1 },
      { id: 'b', shareUnits: 1 },
      { id: 'c', shareUnits: 1 },
    ]);
    expect(rows).toEqual([
      { member_id: 'a', amount_cents: 334, share_units: 1, fixed_cents: null },
      { member_id: 'b', amount_cents: 333, share_units: 1, fixed_cents: null },
      { member_id: 'c', amount_cents: 333, share_units: 1, fixed_cents: null },
    ]);
    expect(sum(rows)).toBe(1000);
  });

  it('honours fixed cents and splits the remainder by shares', () => {
    const rows = allocateMixed(1000, [
      { id: 'a', shareUnits: 1, fixedCents: 300 },
      { id: 'b', shareUnits: 1 },
      { id: 'c', shareUnits: 1 },
    ]);
    expect(rows.find((r) => r.member_id === 'a')).toEqual({
      member_id: 'a',
      amount_cents: 300,
      share_units: 1,
      fixed_cents: 300,
    });
    expect(rows.find((r) => r.member_id === 'b')?.amount_cents).toBe(350);
    expect(rows.find((r) => r.member_id === 'c')?.amount_cents).toBe(350);
    expect(sum(rows)).toBe(1000);
  });

  it('weights remainder by share units', () => {
    const rows = allocateMixed(900, [
      { id: 'a', shareUnits: 2 },
      { id: 'b', shareUnits: 1 },
    ]);
    expect(rows.find((r) => r.member_id === 'a')?.amount_cents).toBe(600);
    expect(rows.find((r) => r.member_id === 'b')?.amount_cents).toBe(300);
  });

  it('gives share members 0 when one member is fixed for the whole amount', () => {
    const rows = allocateMixed(1000, [
      { id: 'a', shareUnits: 1, fixedCents: 1000 },
      { id: 'b', shareUnits: 1 },
    ]);
    expect(rows.find((r) => r.member_id === 'a')?.amount_cents).toBe(1000);
    expect(rows.find((r) => r.member_id === 'b')?.amount_cents).toBe(0);
    expect(sum(rows)).toBe(1000);
  });
});
