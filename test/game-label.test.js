import { describe, it, expect } from 'vitest';
import { formatGame, buildGame, recentGames } from '../src/utils.js';
import { rakeProfileFor } from '../src/pots.js';

describe('formatGame — blinds always shown with the session currency symbol', () => {
  const cases = [
    ['NL P25/P50', 'PHP', 'NL ₱25/₱50'],          // typed "P" because ₱ was hard to type
    ['PLO ₱25/₱50', 'PHP', 'PLO ₱25/₱50'],
    ['25/50', 'PHP', 'NL ₱25/₱50'],
    ['nl $1/$2', 'USD', 'NL $1/$2'],
    ['NL $0.5/$1', 'USD', 'NL $0.5/$1'],
    ['NL ₫50,000/₫100,000', 'VND', 'NL ₫50,000/₫100,000'],
    ['NL HK$25/HK$50', 'HKD', 'NL HK$25/HK$50'],
  ];
  for (const [game, cur, want] of cases) {
    it(`${game} (${cur}) → ${want}`, () => expect(formatGame(game, cur)).toBe(want));
  }
  it('text without blinds is left alone', () => {
    expect(formatGame('Home game', 'PHP')).toBe('Home game');
    expect(formatGame('', 'PHP')).toBe('');
  });
});

describe('buildGame — from the two blind boxes', () => {
  it('adds the currency symbol and thousands separators', () => {
    expect(buildGame('NL', 25, 50, 'PHP')).toBe('NL ₱25/₱50');
    expect(buildGame('PLO', '50000', '100000', 'VND')).toBe('PLO ₫50,000/₫100,000');
  });
  it('incomplete blinds → empty', () => {
    expect(buildGame('NL', '', 50, 'PHP')).toBe('');
    expect(buildGame('NL', 25, '', 'PHP')).toBe('');
  });
});

describe('recentGames — one option per level, shown with the right symbol', () => {
  const sessions = [
    { game: 'NL P25/P50', currency: 'PHP', createdAt: '2026-11-01T00:00:00Z' },
    { game: 'NL ₱25/₱50', currency: 'PHP', createdAt: '2026-11-05T00:00:00Z' },
    { game: 'NL ₱50/₱100', currency: 'PHP', createdAt: '2026-11-03T00:00:00Z' },
    { game: 'NL $1/$2', currency: 'USD', createdAt: '2026-11-06T00:00:00Z' },
  ];
  it('P and ₱ versions of the same level collapse into one', () => {
    expect(recentGames(sessions, 'PHP')).toEqual(['NL ₱25/₱50', 'NL ₱50/₱100']);
  });
});

describe('rake profile matches old "P" spelling of the same level', () => {
  it('finds the old NL P25/P50 session for NL ₱25/₱50', () => {
    const sessions = [{ venue: 'Okada', game: 'NL P25/P50', currency: 'PHP', createdAt: '2026-11-01T00:00:00Z', rakeType: 'percent', rake: 5, rakeMax: 300, jackpot: 20 }];
    expect(rakeProfileFor(sessions, 'Okada', 'NL ₱25/₱50')).toEqual({ rakeType: 'percent', rake: 5, rakeMax: 300, jackpot: 20 });
  });
});
