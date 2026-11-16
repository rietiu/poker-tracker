import { describe, it, expect } from 'vitest';
import { handContributions, buildPots, computeRake, foldedPositions } from '../src/pots.js';
import { heroInvested, handNet } from '../src/utils.js';

const A = (pos, action, amount = 0) => ({ pos, action, amount });
const empty = { actions: [] };

describe('BB ante', () => {
  it('BB puts the ante in as dead money; nobody has to call it', () => {
    // SB completes, BB checks: pot = 200 + 200 + ante 200 = 600
    const hand = { preflop: { actions: [A('SB', 'call', 200), A('BB', 'check')] }, flop: empty, turn: empty, river: empty };
    const c = handContributions(hand, 100, 200, 200);
    expect(c.SB).toBe(200);
    expect(c.BB).toBe(400);
    const { pots, uncalled } = buildPots(c, foldedPositions(hand), 200);
    expect(pots.reduce((s, p) => s + p.amount, 0)).toBe(600);
    expect(uncalled).toBeNull();
  });
  it('without ante nothing changes', () => {
    const hand = { preflop: { actions: [A('SB', 'call', 200), A('BB', 'check')] }, flop: empty, turn: empty, river: empty };
    expect(handContributions(hand, 100, 200)).toEqual(handContributions(hand, 100, 200, 0));
  });
  it('hero in the big blind invests blind plus ante', () => {
    const hand = { myPosition: 'BB', preflop: { actions: [A('SB', 'call', 200), A('BB', 'check')] }, flop: empty, turn: empty, river: empty,
                   result: { outcome: 'won', amount: 600 } };
    expect(heroInvested(hand, 100, 200, 200)).toBe(400);
    expect(handNet(hand, { sb: 100, bb: 200, ante: 200 })).toBe(200);
  });
  it('no rake in MTT', () => {
    expect(computeRake(1000, false, { kind: 'mtt', rakeType: 'percent', rake: 5 })).toEqual({ rake: 0, jackpot: 0, total: 0 });
  });
});
