import { describe, it, expect } from 'vitest';
import {
  computeStreetState, materializeStreet, tapsFromActions, allInTap,
  PREFLOP_ACTION_ORDER, POSTFLOP_ACTION_ORDER, TABLE_POSITIONS,
} from '../src/utils.js';

const pre6 = (hero) => ({
  actionOrder: PREFLOP_ACTION_ORDER[6], activePositions: TABLE_POSITIONS[6],
  initialBet: 2, initialCommitted: { SB: 1, BB: 2 }, hero,
});
const post6 = (live, hero, allInBefore = []) => ({
  actionOrder: POSTFLOP_ACTION_ORDER[6].filter(p => live.includes(p)), activePositions: live,
  initialBet: 0, initialCommitted: {}, hero, allInBefore,
});
const stateOf = (actions, ctx) => computeStreetState(actions, ctx.actionOrder, ctx.activePositions,
  ctx.initialBet, ctx.initialCommitted, ctx.allInBefore || []);

describe('all-in in the street engine', () => {
  it('short all-in call: player is never asked again, action still closes', () => {
    const ctx = { ...pre6('UTG'), close: true };
    const { actions, error, nextPos } = materializeStreet([
      { pos: 'UTG', action: 'raise', amount: 10 },
      { pos: 'CO', action: 'call', amount: 6, allIn: true },
    ], ctx);
    expect(error).toBe(null);
    expect(nextPos).toBe(null);
    expect(stateOf(actions, ctx).committed.CO).toBe(6);
  });
  it('all-in raise reopens action for the earlier raiser', () => {
    const open = materializeStreet([
      { pos: 'UTG', action: 'raise', amount: 6 },
      { pos: 'CO', action: 'raise', amount: 20, allIn: true },
    ], pre6('UTG'));
    expect(open.nextPos).toBe('BTN');
    const closed = materializeStreet([
      { pos: 'UTG', action: 'raise', amount: 6 },
      { pos: 'CO', action: 'raise', amount: 20, allIn: true },
      { pos: 'UTG', action: 'call', amount: 20 },
    ], { ...pre6('UTG'), close: true });
    expect(closed.error).toBe(null);
    expect(closed.nextPos).toBe(null);
  });
  it('later street: a seat all-in earlier is skipped', () => {
    const ctx = { ...post6(['UTG', 'CO', 'BTN'], 'UTG', ['CO']), close: true };
    const { actions, nextPos, error } = materializeStreet([
      { pos: 'UTG', action: 'check', amount: 0 },
      { pos: 'BTN', action: 'check', amount: 0 },
    ], ctx);
    expect(error).toBe(null);
    expect(nextPos).toBe(null);
    expect(actions.map(a => a.pos)).toEqual(['UTG', 'BTN']);
  });
  it('only one player can still act and owes nothing → street is already done', () => {
    const ctx = post6(['UTG', 'CO'], 'UTG', ['CO']);
    expect(stateOf([], ctx).nextPos).toBe(null);
  });
  it('one player left to act but facing an all-in bet → must still act', () => {
    const ctx = post6(['UTG', 'CO'], 'UTG');
    expect(stateOf([{ pos: 'UTG', action: 'bet', amount: 50, allIn: true }], ctx).nextPos).toBe('CO');
  });
  it('tapsFromActions keeps the allIn flag', () => {
    expect(tapsFromActions([{ pos: 'CO', action: 'call', amount: 6, allIn: true }], 'UTG'))
      .toEqual([{ pos: 'CO', action: 'call', amount: 6, allIn: true }]);
  });
});

describe('allInTap', () => {
  const facing10 = [{ pos: 'UTG', action: 'raise', amount: 10 }];
  it('less than the bet → all-in call for less', () => {
    expect(allInTap(facing10, 'CO', 6, pre6('BTN'))).toEqual({ pos: 'CO', action: 'call', amount: 6, allIn: true });
  });
  it('more than the bet → all-in raise', () => {
    expect(allInTap(facing10, 'CO', 30, pre6('BTN'))).toEqual({ pos: 'CO', action: 'raise', amount: 30, allIn: true });
  });
  it('no bet post-flop → all-in bet', () => {
    expect(allInTap([], 'UTG', 40, post6(['UTG', 'CO'], 'CO'))).toEqual({ pos: 'UTG', action: 'bet', amount: 40, allIn: true });
  });
  it('not more than already committed → null', () => {
    expect(allInTap([], 'BB', 2, pre6('BTN'))).toBe(null);
    expect(allInTap([], 'UTG', 0, pre6('BTN'))).toBe(null);
  });
});
