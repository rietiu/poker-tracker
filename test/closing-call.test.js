import { describe, it, expect } from 'vitest';
import { closingCall, PREFLOP_ACTION_ORDER, POSTFLOP_ACTION_ORDER, TABLE_POSITIONS } from '../src/utils.js';

const pre9 = (hero) => ({
  actionOrder: PREFLOP_ACTION_ORDER[9], activePositions: TABLE_POSITIONS[9],
  initialBet: 2, initialCommitted: { SB: 1, BB: 2 }, hero,
});
const post = (live, hero) => ({
  actionOrder: POSTFLOP_ACTION_ORDER[9].filter(p => live.includes(p)), activePositions: live,
  initialBet: 0, initialCommitted: {}, hero,
});

describe('closingCall', () => {
  it('BB calling the last raise closes the round', () => {
    const taps = [{ pos: 'CO', action: 'raise', amount: 6 }];
    expect(closingCall(taps, 'BB', pre9('CO'))).toBe(true);
  });
  it('a call with seats still due behind is not closing', () => {
    const taps = [{ pos: 'CO', action: 'raise', amount: 6 }];
    expect(closingCall(taps, 'BTN', pre9('CO'))).toBe(false);
  });
  it('opener calling a 3-bet closes the round', () => {
    const taps = [
      { pos: 'CO', action: 'raise', amount: 6 },
      { pos: 'BTN', action: 'raise', amount: 18 },
    ];
    // CO is the last seat due once SB/BB (skipped) fold
    expect(closingCall(taps, 'CO', pre9('CO'))).toBe(true);
  });
  it('check (nothing owed) is never a closing call', () => {
    const taps = [{ pos: 'UTG', action: 'call', amount: 2 }];
    expect(closingCall(taps, 'BB', pre9('UTG'))).toBe(false);
  });
  it('postflop: last player calling a bet closes', () => {
    const ctx = post(['SB', 'CO', 'BTN'], 'BTN');
    const taps = [
      { pos: 'SB', action: 'check', amount: 0 },
      { pos: 'CO', action: 'bet', amount: 10 },
    ];
    expect(closingCall(taps, 'BTN', ctx)).toBe(false); // SB still due
    expect(closingCall([...taps, { pos: 'BTN', action: 'call', amount: 10 }], 'SB', ctx)).toBe(true);
  });
  it('invalid tap is not closing', () => {
    const taps = [{ pos: 'CO', action: 'raise', amount: 6 }];
    expect(closingCall(taps, 'UTG', pre9('CO'))).toBe(false); // UTG already passed
  });
});
