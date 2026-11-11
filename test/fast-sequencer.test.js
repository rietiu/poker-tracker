import { describe, it, expect } from 'vitest';
import {
  materializeStreet, tapsFromActions, facingTap, betTap, computeStreetState,
  PREFLOP_ACTION_ORDER, POSTFLOP_ACTION_ORDER, TABLE_POSITIONS, handNet,
} from '../src/utils.js';

const pre9 = (hero) => ({
  actionOrder: PREFLOP_ACTION_ORDER[9], activePositions: TABLE_POSITIONS[9],
  initialBet: 2, initialCommitted: { SB: 1, BB: 2 }, hero,
});
const post = (live, hero) => ({
  actionOrder: POSTFLOP_ACTION_ORDER[9].filter(p => live.includes(p)), activePositions: live,
  initialBet: 0, initialCommitted: {}, hero,
});
const pot = (actions, ctx) => computeStreetState(actions, ctx.actionOrder, ctx.activePositions, ctx.initialBet, ctx.initialCommitted).runningPot;
const folds = (actions) => actions.filter(a => a.action === 'fold').map(a => a.pos);

describe('materializeStreet', () => {
  it('raise + one caller, closed: every other seat folds', () => {
    const ctx = { ...pre9('BTN'), close: true };
    const { actions, nextPos, error } = materializeStreet([
      { pos: 'UTG', action: 'raise', amount: 6 },
      { pos: 'BTN', action: 'call', amount: 6 },
    ], ctx);
    expect(error).toBe(null);
    expect(nextPos).toBe(null);
    expect(folds(actions)).toEqual(['UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'SB', 'BB']);
    expect(pot(actions, ctx)).toBe(12);
  });
  it('open (not closed): only skipped seats fold, nextPos is the next seat due', () => {
    const { actions, nextPos } = materializeStreet([
      { pos: 'UTG', action: 'raise', amount: 6 },
      { pos: 'CO', action: 'call', amount: 6 },
    ], pre9('BB'));
    expect(folds(actions)).toEqual(['UTG+1', 'MP', 'LJ', 'HJ']);
    expect(nextPos).toBe('BTN');
  });
  it('3-bet then opener calls: order preserved across the raise war', () => {
    const ctx = { ...pre9('BTN'), close: true };
    const { actions, error } = materializeStreet([
      { pos: 'UTG', action: 'raise', amount: 6 },
      { pos: 'BTN', action: 'raise', amount: 18 },
      { pos: 'UTG', action: 'call', amount: 18 },
    ], ctx);
    expect(error).toBe(null);
    expect(actions.filter(a => a.action !== 'fold')).toEqual([
      { pos: 'UTG', action: 'raise', amount: 6 },
      { pos: 'BTN', action: 'raise', amount: 18 },
      { pos: 'UTG', action: 'call', amount: 18 },
    ]);
    expect(pot(actions, ctx)).toBe(36);
  });
  it('walk: hero in BB, zero taps, closed → everyone folds, no error', () => {
    const { actions, error, nextPos } = materializeStreet([], { ...pre9('BB'), close: true });
    expect(error).toBe(null);
    expect(nextPos).toBe(null);
    expect(folds(actions)).toEqual(['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB']);
  });
  it('closing past an un-acted hero is an error (hero is never an implied fold)', () => {
    expect(materializeStreet([], { ...pre9('CO'), close: true }).error).toBe('hero-skipped');
  });
  it('a tap that would skip over hero is an error', () => {
    expect(materializeStreet([{ pos: 'BTN', action: 'call', amount: 2 }], pre9('UTG')).error).toBe('hero-skipped');
  });
  it('postflop checked through: nothing folds', () => {
    const ctx = { ...post(['BB', 'CO', 'BTN'], 'BTN'), close: true };
    const { actions, nextPos } = materializeStreet([
      { pos: 'BB', action: 'check', amount: 0 },
      { pos: 'CO', action: 'check', amount: 0 },
      { pos: 'BTN', action: 'check', amount: 0 },
    ], ctx);
    expect(nextPos).toBe(null);
    expect(folds(actions)).toEqual([]);
  });
  it('postflop bet takes it down: skipped live seats fold', () => {
    const ctx = { ...post(['BB', 'CO', 'BTN'], 'BTN'), close: true };
    const { actions, nextPos } = materializeStreet([{ pos: 'BTN', action: 'bet', amount: 10 }], ctx);
    expect(folds(actions)).toEqual(['BB', 'CO']);
    expect(nextPos).toBe(null);
  });
});

describe('tapsFromActions', () => {
  it("drops implied folds but keeps hero's own fold", () => {
    expect(tapsFromActions([
      { pos: 'UTG', action: 'fold', amount: 0 },
      { pos: 'CO', action: 'raise', amount: 6 },
      { pos: 'BTN', action: 'fold', amount: 0 },
    ], 'BTN')).toEqual([
      { pos: 'CO', action: 'raise', amount: 6 },
      { pos: 'BTN', action: 'fold', amount: 0 },
    ]);
  });
  it('round-trips: materialize(tapsFromActions(closed)) equals closed', () => {
    const ctx = { ...pre9('BTN'), close: true };
    const closed = materializeStreet([
      { pos: 'UTG', action: 'raise', amount: 6 },
      { pos: 'BTN', action: 'call', amount: 6 },
    ], ctx).actions;
    expect(materializeStreet(tapsFromActions(closed, 'BTN'), ctx).actions).toEqual(closed);
  });
});

describe('facingTap / betTap', () => {
  it('facing a raise → call to the current bet', () => {
    expect(facingTap([{ pos: 'UTG', action: 'raise', amount: 6 }], 'CO', pre9('CO')))
      .toEqual({ pos: 'CO', action: 'call', amount: 6 });
  });
  it('BB unraised → check (the option)', () => {
    expect(facingTap([{ pos: 'UTG', action: 'call', amount: 2 }], 'BB', pre9('BB')))
      .toEqual({ pos: 'BB', action: 'check', amount: 0 });
  });
  it('postflop first in → check', () => {
    expect(facingTap([], 'BB', post(['BB', 'BTN'], 'BTN')))
      .toEqual({ pos: 'BB', action: 'check', amount: 0 });
  });
  it('betTap: raise when facing a bet, bet when none, null when too small', () => {
    expect(betTap([], 'UTG', 6, pre9('UTG'))).toEqual({ pos: 'UTG', action: 'raise', amount: 6 });
    expect(betTap([], 'BB', 8, post(['BB', 'BTN'], 'BTN'))).toEqual({ pos: 'BB', action: 'bet', amount: 8 });
    expect(betTap([{ pos: 'UTG', action: 'raise', amount: 6 }], 'CO', 5, pre9('CO'))).toBe(null);
  });
});

describe('handNet folded (full hand)', () => {
  it('hero called a raise then folded the flop → loses what they put in', () => {
    const hand = {
      myPosition: 'CO',
      preflop: { actions: [{ pos: 'UTG', action: 'raise', amount: 6 }, { pos: 'CO', action: 'call', amount: 6 }] },
      flop: { actions: [{ pos: 'UTG', action: 'bet', amount: 8 }, { pos: 'CO', action: 'fold', amount: 0 }] },
      result: { outcome: 'folded' },
    };
    expect(handNet(hand, { sb: 1, bb: 2 })).toBe(-6);
  });
  it('hero folded BB preflop without acting → loses the BB', () => {
    expect(handNet({ myPosition: 'BB', preflop: { actions: [] }, result: { outcome: 'folded' } }, { sb: 1, bb: 2 })).toBe(-2);
  });
});
