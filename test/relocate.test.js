import { describe, it, expect } from 'vitest';
import { relocateHero } from '../src/utils.js';

const F = (pos) => ({ pos, action: 'fold', amount: 0 });
const opts = { totalSeats: 6, sb: 1, bb: 2 };
const nonFold = (acts) => acts.filter(a => a.action !== 'fold');

describe('relocateHero', () => {
  it("CO → BTN: hero's call moves to BTN, BTN's old action is replaced, CO never acted", () => {
    const out = relocateHero({
      preflop: [{ pos: 'UTG', action: 'raise', amount: 6 }, F('HJ'), { pos: 'CO', action: 'call', amount: 6 },
        { pos: 'BTN', action: 'call', amount: 6 }, F('SB'), F('BB')],
    }, 'CO', 'BTN', opts);
    expect(nonFold(out.preflop)).toEqual([
      { pos: 'UTG', action: 'raise', amount: 6 },
      { pos: 'BTN', action: 'call', amount: 6 },
    ]);
    expect(out.preflop.find(a => a.pos === 'CO')).toEqual({ pos: 'CO', action: 'fold', amount: 0 });
  });

  it('a move that breaks the order keeps the valid part and leaves hero to act', () => {
    const out = relocateHero({
      preflop: [F('UTG'), F('HJ'), F('CO'), { pos: 'BTN', action: 'raise', amount: 6 }, F('SB'), { pos: 'BB', action: 'call', amount: 6 }],
      flop: [{ pos: 'BB', action: 'check', amount: 0 }, { pos: 'BTN', action: 'bet', amount: 10 }, { pos: 'BB', action: 'call', amount: 10 }],
    }, 'BTN', 'SB', opts);
    expect(nonFold(out.preflop)).toEqual([
      { pos: 'SB', action: 'raise', amount: 6 },
      { pos: 'BB', action: 'call', amount: 6 },
    ]);
    // Post-flop SB acts first now: BB's check can't come before hero → dropped; hero re-enters.
    expect(out.flop).toEqual([]);
  });

  it("hero's fold moves with hero", () => {
    const out = relocateHero({
      preflop: [{ pos: 'UTG', action: 'raise', amount: 6 }, F('HJ'), F('CO'), F('BTN'), F('SB'), F('BB')],
    }, 'CO', 'HJ', opts);
    expect(out.preflop.filter(a => a.pos === 'HJ')).toEqual([{ pos: 'HJ', action: 'fold', amount: 0 }]);
    expect(nonFold(out.preflop)).toEqual([{ pos: 'UTG', action: 'raise', amount: 6 }]);
  });

  it('same position → unchanged', () => {
    const streets = { preflop: [{ pos: 'UTG', action: 'raise', amount: 6 }] };
    expect(relocateHero(streets, 'UTG', 'UTG', opts)).toBe(streets);
  });
});
