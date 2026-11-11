import { describe, it, expect } from 'vitest';
import { revalidateStreets, pendingFolds, recentValues, PREFLOP_ACTION_ORDER, TABLE_POSITIONS } from '../src/utils.js';

const F = (pos) => ({ pos, action: 'fold', amount: 0 });
const opts = { totalSeats: 6, sb: 1, bb: 2 };
const pre6 = (hero) => ({
  actionOrder: PREFLOP_ACTION_ORDER[6], activePositions: TABLE_POSITIONS[6],
  initialBet: 2, initialCommitted: { SB: 1, BB: 2 }, hero,
});

describe('revalidateStreets', () => {
  it('drops later-street actions of a player who is now out', () => {
    const out = revalidateStreets({
      preflop: [{ pos: 'UTG', action: 'raise', amount: 6 }, F('HJ'), F('CO'), { pos: 'BTN', action: 'call', amount: 6 }, F('SB'), F('BB')],
      flop: [{ pos: 'UTG', action: 'check', amount: 0 }, { pos: 'CO', action: 'bet', amount: 10 }, { pos: 'BTN', action: 'call', amount: 10 }],
    }, 'BTN', opts);
    expect(out.flop).toEqual([{ pos: 'UTG', action: 'check', amount: 0 }]);
  });
  it('valid streets are left exactly as they were', () => {
    const streets = {
      preflop: [{ pos: 'UTG', action: 'raise', amount: 6 }, F('HJ'), F('CO'), { pos: 'BTN', action: 'call', amount: 6 }, F('SB'), F('BB')],
      flop: [{ pos: 'UTG', action: 'check', amount: 0 }, { pos: 'BTN', action: 'check', amount: 0 }],
    };
    expect(revalidateStreets(streets, 'BTN', opts)).toEqual(streets);
  });
});

describe('pendingFolds', () => {
  it('names the seats Done would fold', () => {
    expect(pendingFolds([{ pos: 'UTG', action: 'raise', amount: 6 }, { pos: 'BTN', action: 'call', amount: 6 }], pre6('UTG')))
      .toEqual(['SB', 'BB']);
  });
  it('empty when hero still has to act', () => {
    expect(pendingFolds([{ pos: 'UTG', action: 'raise', amount: 6 }, { pos: 'BTN', action: 'call', amount: 6 }], pre6('BB')))
      .toEqual([]);
  });
  it('empty when the round is already closed', () => {
    expect(pendingFolds([{ pos: 'UTG', action: 'raise', amount: 6 }, { pos: 'BB', action: 'call', amount: 6 }], pre6('UTG')))
      .toEqual([]);
  });
});

describe('recentValues', () => {
  const sessions = [
    { venue: 'Okada', game: 'NL ₱25/₱50', currency: 'PHP', createdAt: '2026-10-01T00:00:00Z' },
    { venue: 'Solaire', game: 'NL ₱50/₱100', currency: 'PHP', createdAt: '2026-11-01T00:00:00Z' },
    { venue: 'okada ', game: 'NL ₱25/₱50', currency: 'PHP', createdAt: '2026-11-05T00:00:00Z' },
    { venue: 'Wynn', game: 'NL $1/$2', currency: 'USD', createdAt: '2026-09-01T00:00:00Z' },
    { venue: '', game: '', currency: 'PHP', createdAt: '2026-11-06T00:00:00Z' },
  ];
  it('distinct, most recent first, ignores case/space and blanks', () => {
    expect(recentValues(sessions, 'venue')).toEqual(['okada', 'Solaire', 'Wynn']);
  });
  it('can filter, e.g. stakes in the chosen currency', () => {
    expect(recentValues(sessions, 'game', s => s.currency === 'PHP')).toEqual(['NL ₱25/₱50', 'NL ₱50/₱100']);
  });
});
