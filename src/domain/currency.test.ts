import { describe, expect, it } from 'vitest';
import {
  allCurrencies,
  currencyName,
  currencySymbol,
} from './currency';

describe('currencySymbol', () => {
  it('maps EUR and USD to their symbols', () => {
    expect(currencySymbol('EUR')).toBe('€');
    expect(currencySymbol('USD')).toBe('$');
    expect(currencySymbol('gbp')).toBe('£');
  });

  it('leaves an unknown or blank code as typed', () => {
    expect(currencySymbol('ZZZ')).toBe('ZZZ');
    expect(currencySymbol('euros')).toBe('euros');
    expect(currencySymbol('')).toBe('');
  });
});

describe('currencyName', () => {
  it('names EUR in English', () => {
    expect(currencyName('EUR')).toBe('Euro');
  });
});

describe('allCurrencies', () => {
  it('lists every tender code, Euro first, without metals', () => {
    const list = allCurrencies();
    const codes = list.map((c) => c.code);
    expect(list.length).toBeGreaterThan(100);
    expect(codes[0]).toBe('EUR');
    expect(codes).toContain('USD');
    expect(codes).toContain('JPY');
    expect(codes).not.toContain('XAU');
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('carries a real symbol on Euro and Yen', () => {
    const list = allCurrencies();
    expect(list.find((c) => c.code === 'EUR')?.symbol).toBe('€');
    expect(list.find((c) => c.code === 'JPY')?.symbol).toBe('¥');
  });
});
