import { describe, it, expect } from 'vitest';
import { handContributions, buildPots, computeRake, heroTake, endedPreflop, foldedPositions } from '../src/pots.js';

const F = (pos) => ({ pos, action: 'fold', amount: 0 });

const headsUpCalled = {
  preflop: { actions: [F('UTG'), F('HJ'), F('CO'), { pos: 'BTN', action: 'raise', amount: 6 }, F('SB'), { pos: 'BB', action: 'call', amount: 6 }] },
  flop: { actions: [{ pos: 'BB', action: 'check' }, { pos: 'BTN', action: 'bet', amount: 10 }, { pos: 'BB', action: 'call', amount: 10 }] },
};
const uncalledFlopBet = {
  preflop: headsUpCalled.preflop,
  flop: { actions: [{ pos: 'BB', action: 'check' }, { pos: 'BTN', action: 'bet', amount: 10 }, F('BB')] },
};
const threeWayAllIn = {
  preflop: { actions: [
    { pos: 'UTG', action: 'raise', amount: 100 }, F('HJ'),
    { pos: 'CO', action: 'call', amount: 30, allIn: true },
    { pos: 'BTN', action: 'call', amount: 100 }, F('SB'), F('BB'),
  ] },
};
const walk = { preflop: { actions: [F('UTG'), F('HJ'), F('CO'), F('BTN'), F('SB')] } };

describe('handContributions', () => {
  it('sums every street and includes posted blinds', () => {
    expect(handContributions(headsUpCalled, 1, 2)).toEqual({ SB: 1, BB: 16, BTN: 16, UTG: 0, HJ: 0, CO: 0 });
  });
});

describe('buildPots', () => {
  it('single called pot, nothing returned', () => {
    const h = headsUpCalled;
    expect(buildPots(handContributions(h, 1, 2), foldedPositions(h))).toEqual({
      pots: [{ amount: 33, eligible: ['BB', 'BTN'] }], uncalled: null,
    });
  });
  it('uncalled bet goes back to the bettor', () => {
    const h = uncalledFlopBet;
    expect(buildPots(handContributions(h, 1, 2), foldedPositions(h))).toEqual({
      pots: [{ amount: 13, eligible: ['BTN'] }], uncalled: { pos: 'BTN', amount: 10 },
    });
  });
  it('short all-in creates a main pot and a side pot', () => {
    const h = threeWayAllIn;
    expect(buildPots(handContributions(h, 1, 2), foldedPositions(h))).toEqual({
      pots: [
        { amount: 93, eligible: ['BTN', 'CO', 'UTG'] },
        { amount: 140, eligible: ['BTN', 'UTG'] },
      ],
      uncalled: null,
    });
  });
  it('walk: BB gets SB as the pot and its own extra blind back', () => {
    const h = walk;
    expect(buildPots(handContributions(h, 1, 2), foldedPositions(h))).toEqual({
      pots: [{ amount: 2, eligible: ['BB'] }], uncalled: { pos: 'BB', amount: 1 },
    });
  });
});

describe('endedPreflop', () => {
  it('true when everyone folded pre-flop, false once two players see a flop', () => {
    expect(endedPreflop(walk)).toBe(true);
    expect(endedPreflop(headsUpCalled)).toBe(false);
    expect(endedPreflop(threeWayAllIn)).toBe(false); // all-in pre-flop still runs out a board
  });
});

describe('computeRake', () => {
  const cfg = { rakeType: 'percent', rake: 5, rakeMax: 10, jackpot: 20 };
  it('percent with cap, plus jackpot on top of the cap', () => {
    expect(computeRake(233, false, cfg)).toEqual({ rake: 10, jackpot: 20, total: 30 });
  });
  it('no rake and no jackpot when the hand ended pre-flop', () => {
    expect(computeRake(13, true, cfg)).toEqual({ rake: 0, jackpot: 0, total: 0 });
  });
  it('flat rake, never more than the pot', () => {
    expect(computeRake(40, false, { rakeType: 'flat', rake: 50, jackpot: 0 })).toEqual({ rake: 40, jackpot: 0, total: 40 });
  });
  it('no config → nothing taken', () => {
    expect(computeRake(100, false, null)).toEqual({ rake: 0, jackpot: 0, total: 0 });
  });
});

describe('heroTake', () => {
  const pots = [{ amount: 93, eligible: ['BTN', 'CO', 'UTG'] }, { amount: 140, eligible: ['BTN', 'UTG'] }];
  it('rake comes out of the main pot', () => {
    expect(heroTake([{ ...pots[0], winners: ['CO'] }, { ...pots[1], winners: ['UTG'] }], 'CO', 30, null)).toBe(63);
    expect(heroTake([{ ...pots[0], winners: ['CO'] }, { ...pots[1], winners: ['UTG'] }], 'UTG', 30, null)).toBe(140);
  });
  it('split pot divides evenly', () => {
    expect(heroTake([{ ...pots[0], winners: ['CO', 'BTN'] }, { ...pots[1], winners: ['BTN'] }], 'CO', 30, null)).toBe(31.5);
  });
  it("hero's uncalled chips come back too", () => {
    expect(heroTake([{ amount: 2, eligible: ['BB'], winners: ['BB'] }], 'BB', 0, { pos: 'BB', amount: 1 })).toBe(3);
  });
});

import { rakeProfileFor } from '../src/pots.js';

describe('rakeProfileFor', () => {
  const sessions = [
    { venue: 'Okada', game: 'NL ₱25/₱50', createdAt: '2026-10-01T10:00:00Z', rakeType: 'percent', rake: 5, rakeMax: 300, jackpot: 20 },
    { venue: 'okada ', game: 'nl ₱25/₱50', createdAt: '2026-11-01T10:00:00Z', rakeType: 'percent', rake: 5, rakeMax: 400, jackpot: 25 },
    { venue: 'Okada', game: 'NL ₱50/₱100', createdAt: '2026-11-05T10:00:00Z', rakeType: 'percent', rake: 5, rakeMax: 600, jackpot: 50 },
  ];
  it('latest session with the same venue + game (case / space insensitive)', () => {
    expect(rakeProfileFor(sessions, 'OKADA', 'NL ₱25/₱50')).toEqual({ rakeType: 'percent', rake: 5, rakeMax: 400, jackpot: 25 });
  });
  it('different stakes at the same venue have their own settings', () => {
    expect(rakeProfileFor(sessions, 'Okada', 'NL ₱50/₱100').rakeMax).toBe(600);
  });
  it('no match → null', () => {
    expect(rakeProfileFor(sessions, 'Solaire', 'NL ₱25/₱50')).toBe(null);
    expect(rakeProfileFor(sessions, '', 'NL ₱25/₱50')).toBe(null);
  });
});
