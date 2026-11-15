import { describe, it, expect } from 'vitest';
import { cbetHint, cbetSizes, checksUntil, materializeStreet, POSTFLOP_ACTION_ORDER } from '../src/utils.js';

const post = (live, hero) => ({
  actionOrder: POSTFLOP_ACTION_ORDER[9].filter(p => live.includes(p)), activePositions: live,
  initialBet: 0, initialCommitted: {}, hero,
});

const pre3bet = [
  { pos: 'UTG', action: 'fold', amount: 0 },
  { pos: 'CO', action: 'raise', amount: 300 },
  { pos: 'BTN', action: 'raise', amount: 900 },
  { pos: 'SB', action: 'fold', amount: 0 },
  { pos: 'BB', action: 'fold', amount: 0 },
  { pos: 'CO', action: 'call', amount: 900 },
];

describe('cbetHint', () => {
  it('flop: preflop aggressor is the last raiser, amount is the final preflop bet', () => {
    expect(cbetHint({ preflop: pre3bet }, 'flop')).toEqual({ aggressor: 'BTN', pfAmount: 900 });
  });
  it('limped pot: no aggressor, no hint', () => {
    expect(cbetHint({ preflop: [{ pos: 'BTN', action: 'call', amount: 100 }, { pos: 'BB', action: 'check', amount: 0 }] }, 'flop')).toBe(null);
  });
  it('turn after a checked-through flop: delayed c-bet by the preflop aggressor', () => {
    const flop = [{ pos: 'CO', action: 'check', amount: 0 }, { pos: 'BTN', action: 'check', amount: 0 }];
    expect(cbetHint({ preflop: pre3bet, flop }, 'turn')).toEqual({ aggressor: 'BTN', pfAmount: 900 });
  });
  it('turn after a flop bet: the flop bettor is the aggressor', () => {
    const flop = [{ pos: 'CO', action: 'bet', amount: 900 }, { pos: 'BTN', action: 'call', amount: 900 }];
    expect(cbetHint({ preflop: pre3bet, flop }, 'turn')).toEqual({ aggressor: 'CO', pfAmount: 900 });
  });
});

describe('cbetSizes', () => {
  it('heads-up: preflop amount and pot', () => {
    expect(cbetSizes(900, 1950, 2, 100).map(c => [c.label, c.amt])).toEqual([['PF', 900], ['Pot', 1950]]);
  });
  it('3-way adds 2/3 pot, rounded to bb', () => {
    expect(cbetSizes(300, 1000, 3, 100).map(c => [c.label, c.amt])).toEqual([['PF', 300], ['2/3', 700], ['Pot', 1000]]);
  });
  it('4+ way adds 3/4 pot', () => {
    expect(cbetSizes(300, 1300, 4, 100).map(c => [c.label, c.amt])).toEqual([['PF', 300], ['3/4', 1000], ['Pot', 1300]]);
  });
});

describe('checksUntil', () => {
  it('checks every live seat before the target, including hero', () => {
    const ctx = post(['SB', 'BB', 'CO', 'BTN'], 'BB');
    const taps = checksUntil([], 'CO', ctx);
    expect(taps.map(t => [t.pos, t.action])).toEqual([['SB', 'check'], ['BB', 'check']]);
    expect(materializeStreet(taps, ctx).nextPos).toBe('CO');
  });
  it('target first to act: no checks', () => {
    expect(checksUntil([], 'SB', post(['SB', 'BTN'], 'BTN'))).toEqual([]);
  });
  it('target not due: null', () => {
    expect(checksUntil([], 'UTG', post(['SB', 'BTN'], 'BTN'))).toBe(null);
  });
});
