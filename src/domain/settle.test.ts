import { describe, expect, it } from 'vitest';
import type { Balance } from './balances';
import { settlementsForMember, suggestSettlements } from './settle';

const row = (
  member_id: string,
  net_cents: number,
  display_name = member_id,
): Balance => ({ member_id, display_name, net_cents });

describe('suggestSettlements', () => {
  it('settles two people with one transfer of the debt', () => {
    expect(suggestSettlements([row('a', -300, 'Ana'), row('b', 300, 'Bo')])).toEqual([
      {
        from_member_id: 'a',
        to_member_id: 'b',
        amount_cents: 300,
        from_display_name: 'Ana',
        to_display_name: 'Bo',
      },
    ]);
  });

  it('returns nothing when only one member is off zero', () => {
    expect(suggestSettlements([row('a', 900), row('b', 0)])).toEqual([]);
  });

  it('returns nothing when everyone is already square', () => {
    expect(suggestSettlements([row('a', 0), row('b', 0)])).toEqual([]);
    expect(suggestSettlements([])).toEqual([]);
  });

  it('splits a zero-sum subgroup out so greedy cannot inflate the count', () => {
    // {+5, −5} settle in one transfer; {+6, −4, −2} in two. Greedy poorest↔richest
    // spends four on the same nets.
    expect(
      suggestSettlements([
        row('a', 600),
        row('b', -400),
        row('c', -200),
        row('d', 500),
        row('e', -500),
      ]),
    ).toEqual([
      {
        from_member_id: 'b',
        to_member_id: 'a',
        amount_cents: 400,
        from_display_name: 'b',
        to_display_name: 'a',
      },
      {
        from_member_id: 'c',
        to_member_id: 'a',
        amount_cents: 200,
        from_display_name: 'c',
        to_display_name: 'a',
      },
      {
        from_member_id: 'e',
        to_member_id: 'd',
        amount_cents: 500,
        from_display_name: 'e',
        to_display_name: 'd',
      },
    ]);
  });

  it('is order-independent — two devices holding the nets differently agree', () => {
    const nets: [string, number][] = [
      ['a', 600],
      ['b', -400],
      ['c', -200],
      ['d', 500],
      ['e', -500],
    ];
    expect(suggestSettlements(nets.map(([id, n]) => row(id, n)))).toEqual(
      suggestSettlements([...nets].reverse().map(([id, n]) => row(id, n))),
    );
  });

  it('omits an unmatched remainder instead of inventing a person', () => {
    expect(
      suggestSettlements([row('a', 400), row('b', -400), row('c', 300)]),
    ).toEqual([
      {
        from_member_id: 'b',
        to_member_id: 'a',
        amount_cents: 400,
        from_display_name: 'b',
        to_display_name: 'a',
      },
    ]);
  });

  it('zeros every member it settled, and only them', () => {
    const balances = [
      row('a', 600),
      row('b', -400),
      row('c', -200),
      row('d', 500),
      row('e', -500),
      row('ghost', 100),
    ];
    const net = new Map(balances.map((b) => [b.member_id, b.net_cents]));
    for (const s of suggestSettlements(balances)) {
      net.set(s.from_member_id, (net.get(s.from_member_id) ?? 0) + s.amount_cents);
      net.set(s.to_member_id, (net.get(s.to_member_id) ?? 0) - s.amount_cents);
    }
    expect(net.get('ghost')).toBe(100);
    expect([...net].filter(([id, n]) => id !== 'ghost' && n !== 0)).toEqual([]);
  });

  it('falls back to poorest-richest when more than 16 members are off zero', () => {
    const balances = [
      ...Array.from({ length: 8 }, (_, i) => row(`d${i}`, -100)),
      ...Array.from({ length: 8 }, (_, i) => row(`c${i}`, 100)),
      row('leftover', 50),
    ];
    expect(suggestSettlements(balances)).toHaveLength(8);
  });
});

describe('settlementsForMember', () => {
  const transfers = [
    {
      from_member_id: 'b',
      to_member_id: 'a',
      amount_cents: 400,
      from_display_name: 'Bo',
      to_display_name: 'Ana',
    },
    {
      from_member_id: 'c',
      to_member_id: 'a',
      amount_cents: 200,
      from_display_name: 'Cy',
      to_display_name: 'Ana',
    },
    {
      from_member_id: 'e',
      to_member_id: 'd',
      amount_cents: 500,
      from_display_name: 'Ed',
      to_display_name: 'Di',
    },
  ];

  it('is empty when that member has no outgoing transfer', () => {
    expect(settlementsForMember(transfers, 'a')).toEqual([]);
  });

  it('returns only transfers that member pays', () => {
    expect(settlementsForMember(transfers, 'b')).toEqual([transfers[0]]);
  });

  it('keeps the group list order when one member pays more than once', () => {
    const twice = [
      transfers[0],
      {
        from_member_id: 'c',
        to_member_id: 'd',
        amount_cents: 50,
        from_display_name: 'Cy',
        to_display_name: 'Di',
      },
      transfers[1],
    ];
    expect(settlementsForMember(twice, 'c')).toEqual([twice[1], twice[2]]);
  });
});
