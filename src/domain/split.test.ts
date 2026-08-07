import { describe, expect, it } from 'vitest';
import type { Allocation } from '@/src/types/group';
import { splitEqually } from './split';

const sum = (allocations: readonly Allocation[]) =>
  allocations.reduce((total, a) => total + a.amount_cents, 0);

describe('splitEqually', () => {
  it('gives everyone the same share when it divides evenly', () => {
    expect(splitEqually(900, ['b', 'a', 'c'])).toEqual([
      { member_id: 'a', amount_cents: 300 },
      { member_id: 'b', amount_cents: 300 },
      { member_id: 'c', amount_cents: 300 },
    ]);
  });

  it('hands leftover cents out in id order, one each', () => {
    expect(splitEqually(1000, ['c', 'a', 'b'])).toEqual([
      { member_id: 'a', amount_cents: 334 },
      { member_id: 'b', amount_cents: 333 },
      { member_id: 'c', amount_cents: 333 },
    ]);
  });

  it('allocates every cent, whatever the amount', () => {
    const ids = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'];
    for (let amount = 1; amount <= 200; amount += 1) {
      for (let n = 1; n <= ids.length; n += 1) {
        const allocations = splitEqually(amount, ids.slice(0, n));
        expect(sum(allocations)).toBe(amount);
      }
    }
  });

  it('never leaves two members more than one cent apart', () => {
    const amounts = splitEqually(1001, ['a', 'b', 'c']).map(
      (a) => a.amount_cents,
    );
    expect(Math.max(...amounts) - Math.min(...amounts)).toBe(1);
  });

  it('is order-independent — two devices holding the roster differently agree', () => {
    expect(splitEqually(1000, ['c', 'a', 'b'])).toEqual(
      splitEqually(1000, ['a', 'b', 'c']),
    );
  });

  it('ignores duplicate member ids rather than double-charging', () => {
    expect(splitEqually(600, ['a', 'a', 'b'])).toEqual([
      { member_id: 'a', amount_cents: 300 },
      { member_id: 'b', amount_cents: 300 },
    ]);
  });

  it('allocates nothing when there is nobody to allocate to', () => {
    expect(splitEqually(500, [])).toEqual([]);
  });

  it('refuses amounts that are not positive whole cents', () => {
    expect(() => splitEqually(0, ['a'])).toThrow();
    expect(() => splitEqually(-100, ['a'])).toThrow();
    expect(() => splitEqually(10.5, ['a'])).toThrow();
  });
});
