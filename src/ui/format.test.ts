import { describe, expect, it } from 'vitest';
import { formatCents, formatMoney, memberLabel } from './format';

describe('formatCents', () => {
  it('writes integer cents as decimal text', () => {
    expect(formatCents(1234)).toBe('12.34');
    expect(formatCents(-50)).toBe('0.50');
  });
});

describe('formatMoney', () => {
  it('puts the currency symbol after the amount', () => {
    expect(formatMoney(1234, 'EUR')).toBe('12.34 €');
    expect(formatMoney(1000, 'USD', true)).toBe('+10.00 $');
    expect(formatMoney(-333, 'GBP', true)).toBe('−3.33 £');
  });

  it('keeps an unknown code as typed', () => {
    expect(formatMoney(100, 'FOO')).toBe('1.00 FOO');
  });
});

describe('memberLabel', () => {
  it('writes You without the parenthetical name', () => {
    expect(memberLabel('Ana', true)).toBe('You');
    expect(memberLabel('Bo', false)).toBe('Bo');
  });
});
