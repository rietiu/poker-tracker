import { describe, it, expect } from 'vitest';
import { handNet, heroInvested, heroBlindPosted, sumNet } from '../src/utils.js';

const wonHand = {
  myPosition: 'BTN',
  preflop: { actions: [
    { pos: 'BTN', action: 'raise', amount: 6 },
    { pos: 'BB', action: 'call', amount: 6 },
  ], pot: 13 },
  flop: { cards: ['2h', '7d', 'Kc'], actions: [
    { pos: 'BB', action: 'check', amount: 0 },
    { pos: 'BTN', action: 'bet', amount: 8 },
    { pos: 'BB', action: 'fold', amount: 0 },
  ], pot: 21 },
  turn: { card: null, actions: [] },
  river: { card: null, actions: [] },
  result: { outcome: 'won', amount: '21' }, // gross net-pot, as stored today
};

describe('heroInvested', () => {
  it('sums hero voluntary chips across streets', () => {
    expect(heroInvested(wonHand)).toBe(14); // 6 preflop + 8 flop
  });
  it('is 0 for a quick hand', () => {
    expect(heroInvested({ quick: true, result: { outcome: 'won', amount: '50' } })).toBe(0);
  });
  it('counts the hero blind when hero is in the blinds', () => {
    const h = {
      myPosition: 'BB',
      preflop: { actions: [{ pos: 'BB', action: 'call', amount: 6 }] },
      flop: { actions: [] }, turn: { actions: [] }, river: { actions: [] },
    };
    expect(heroInvested(h, 1, 2)).toBe(6); // call to 6 already includes the posted 2
  });
});

describe('heroBlindPosted', () => {
  it('returns bb when hero is BB', () => {
    expect(heroBlindPosted({ myPosition: 'BB' }, 1, 2)).toBe(2);
  });
  it('returns sb when hero is SB', () => {
    expect(heroBlindPosted({ myPosition: 'SB' }, 1, 2)).toBe(1);
  });
  it('returns 0 when hero is in the field', () => {
    expect(heroBlindPosted({ myPosition: 'CO' }, 1, 2)).toBe(0);
  });
});

describe('handNet', () => {
  it('won = gross pot minus hero investment', () => {
    expect(handNet(wonHand, { sb: 1, bb: 2 })).toBe(7); // 21 - 14
  });
  it('folded in the BB costs one big blind', () => {
    const h = { myPosition: 'BB', preflop: { actions: [] }, result: { outcome: 'folded', amount: '' } };
    expect(handNet(h, { sb: 1, bb: 2 })).toBe(-2);
  });
  it('folded in the field costs nothing', () => {
    const h = { myPosition: 'CO', preflop: { actions: [] }, result: { outcome: 'folded', amount: '' } };
    expect(handNet(h, { sb: 1, bb: 2 })).toBe(0);
  });
  it('quick won uses the typed amount as net', () => {
    expect(handNet({ quick: true, result: { outcome: 'won', amount: '40' } })).toBe(40);
  });
  it('quick lost uses the typed amount as net loss', () => {
    expect(handNet({ quick: true, result: { outcome: 'lost', amount: '40' } })).toBe(-40);
  });
  it('lost with recorded actions = minus hero investment', () => {
    const h = { ...wonHand, result: { outcome: 'lost', amount: '999' } };
    expect(handNet(h, { sb: 1, bb: 2 })).toBe(-14);
  });
  it('lost with no recorded actions falls back to the typed amount', () => {
    const h = { myPosition: 'CO', preflop: { actions: [] }, flop: { actions: [] }, turn: { actions: [] }, river: { actions: [] }, result: { outcome: 'lost', amount: '120' } };
    expect(handNet(h, { sb: 1, bb: 2 })).toBe(-120);
  });
});

describe('sumNet', () => {
  it('skips incomplete drafts', () => {
    const hands = [
      { quick: true, result: { outcome: 'won', amount: '10' } },
      { incomplete: true, result: { outcome: 'won', amount: '999' } },
    ];
    expect(sumNet(hands)).toBe(10);
  });
  it('adds wins and losses with sign', () => {
    const hands = [
      { quick: true, result: { outcome: 'won', amount: '30' } },
      { quick: true, result: { outcome: 'lost', amount: '12' } },
      { quick: true, result: { outcome: 'folded', amount: '' } },
    ];
    expect(sumNet(hands)).toBe(18);
  });
});
