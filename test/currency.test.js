import { describe, it, expect } from 'vitest';
import { CURRENCIES, currencySymbol, formatSigned, sumByCurrency, formatTotals, parseBB, parseSB } from '../src/utils.js';

describe('currencies', () => {
  it('offers PHP, USD and the common SE Asian poker currencies', () => {
    const codes = CURRENCIES.map(c => c.code);
    for (const c of ['PHP', 'USD', 'THB', 'VND', 'MYR', 'SGD']) expect(codes).toContain(c);
  });
  it('maps codes to symbols, keeps old EUR/GBP, falls back to the code', () => {
    expect(currencySymbol('PHP')).toBe('₱');
    expect(currencySymbol('THB')).toBe('฿');
    expect(currencySymbol('VND')).toBe('₫');
    expect(currencySymbol('MYR')).toBe('RM');
    expect(currencySymbol('SGD')).toBe('S$');
    expect(currencySymbol('EUR')).toBe('€');
    expect(currencySymbol(undefined)).toBe('$');
    expect(currencySymbol('KRW')).toBe('KRW ');
  });
});

describe('formatSigned', () => {
  it('signs and adds the currency symbol', () => {
    expect(formatSigned(1200, 'PHP')).toBe('+₱1,200');
    expect(formatSigned(-40, 'USD')).toBe('−$40');
    expect(formatSigned(0, 'MYR')).toBe('+RM0');
  });
});

describe('sumByCurrency / formatTotals', () => {
  it('never adds different currencies together', () => {
    const totals = sumByCurrency([
      { currency: 'PHP', amount: 1000 }, { currency: 'USD', amount: -40 }, { currency: 'PHP', amount: 200 },
      { currency: undefined, amount: 5 },
    ]);
    expect(totals).toEqual({ PHP: 1200, USD: -35 });
    expect(formatTotals(totals)).toBe('+₱1,200 · −$35');
  });
  it('empty → +0 in no particular currency', () => {
    expect(formatTotals({})).toBe('+0');
  });
});

describe('parseBB / parseSB with any currency', () => {
  const cases = [
    ['NL $1/$2', 1, 2],
    ['NL ₱25/₱50', 25, 50],
    ['PLO ฿100/฿200', 100, 200],
    ['NL ₫50,000/₫100,000', 50000, 100000],
    ['NL RM5/RM10', 5, 10],
    ['NL S$2/S$4', 2, 4],
    ['NL $0.5/$1', 0.5, 1],
    ['25/50', 25, 50],
  ];
  for (const [game, sb, bb] of cases) {
    it(game, () => {
      expect(parseSB(game)).toBe(sb);
      expect(parseBB(game)).toBe(bb);
    });
  }
});
