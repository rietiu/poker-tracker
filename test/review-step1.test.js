import { describe, it, expect } from 'vitest';
import {
  calcPosition, TABLE_POSITIONS, PREFLOP_ACTION_ORDER, POSTFLOP_ACTION_ORDER,
  handNet, isValidBetAmount, nextHandNum,
} from '../src/utils.js';

describe('table size ↔ position lists (bug 1)', () => {
  for (const n of [6, 8, 9]) {
    it(`${n}-max: every calcPosition result is a table position, one per seat`, () => {
      const fromSeats = [...Array(n)].map((_, i) => calcPosition(n, i + 1, 1));
      expect(new Set(fromSeats).size).toBe(n);
      expect([...TABLE_POSITIONS[n]].sort()).toEqual([...fromSeats].sort());
      expect([...PREFLOP_ACTION_ORDER[n]].sort()).toEqual([...fromSeats].sort());
      expect([...POSTFLOP_ACTION_ORDER[n]].sort()).toEqual([...fromSeats].sort());
    });
  }
  it('8-max preflop order puts LJ between UTG+1 and HJ', () => {
    expect(PREFLOP_ACTION_ORDER[8]).toEqual(['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
  });
});

describe('isValidBetAmount (bug 2)', () => {
  it('rejects a raise-to not above the current bet', () => {
    expect(isValidBetAmount(5, 10)).toBe(false);
    expect(isValidBetAmount(10, 10)).toBe(false);
  });
  it('accepts a raise-to above the current bet', () => {
    expect(isValidBetAmount(25, 10)).toBe(true);
  });
  it('rejects zero / negative / non-numeric bets', () => {
    expect(isValidBetAmount(0, 0)).toBe(false);
    expect(isValidBetAmount(-4, 0)).toBe(false);
    expect(isValidBetAmount('abc', 0)).toBe(false);
  });
  it('accepts a positive opening bet', () => {
    expect(isValidBetAmount(8, 0)).toBe(true);
  });
});

describe('split net (bug 3)', () => {
  // BTN raises to 6, BB calls → pot 13; chopped, hero gets 6.5 back
  const splitHand = (amount) => ({
    myPosition: 'BTN',
    preflop: { actions: [
      { pos: 'BTN', action: 'raise', amount: 6 },
      { pos: 'BB', action: 'call', amount: 6 },
    ] },
    result: { outcome: 'split', amount },
  });
  it('typed amount is hero\'s pot share (gross), like won', () => {
    expect(handNet(splitHand('6.5'), { sb: 1, bb: 2 })).toBe(0.5);
  });
  it('blank amount still nets −invested', () => {
    expect(handNet(splitHand(''), { sb: 1, bb: 2 })).toBe(-6);
  });
});

describe('quick folded net (bug 4)', () => {
  it('quick hand folded from BB loses the big blind', () => {
    expect(handNet({ quick: true, myPosition: 'BB', result: { outcome: 'folded' } }, { sb: 1, bb: 2 })).toBe(-2);
  });
  it('quick hand folded from SB loses the small blind', () => {
    expect(handNet({ quick: true, myPosition: 'SB', result: { outcome: 'folded' } }, { sb: 1, bb: 2 })).toBe(-1);
  });
  it('quick hand folded from BTN costs nothing', () => {
    expect(handNet({ quick: true, myPosition: 'BTN', result: { outcome: 'folded' } }, { sb: 1, bb: 2 })).toBe(0);
  });
});

describe('nextHandNum (bug 8)', () => {
  it('is max existing handNum + 1, so deleting a hand never causes a duplicate', () => {
    const hands = [{ handNum: 1 }, { handNum: 2 }, { handNum: 4 }]; // #3 deleted
    expect(nextHandNum(hands)).toBe(5);
  });
  it('ignores drafts', () => {
    expect(nextHandNum([{ handNum: 1 }, { incomplete: true, handNum: 9 }])).toBe(2);
  });
  it('starts at 1 for an empty session', () => {
    expect(nextHandNum([])).toBe(1);
  });
});
