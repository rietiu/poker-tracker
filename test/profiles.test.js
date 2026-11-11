import { describe, it, expect } from 'vitest';
import { sessionProfiles, profileSummary } from '../src/utils.js';

const S = (o) => ({ totalSeats: 9, rakeType: 'percent', rake: 5, rakeMax: 0, jackpot: 0, ...o });
const sessions = [
  S({ venue: 'Okada', currency: 'PHP', game: 'NL P50/P100', rake: 10, rakeMax: 400, jackpot: 20, createdAt: '2026-10-01T00:00:00Z' }),
  S({ venue: 'okada', currency: 'PHP', game: 'NL ₱50/₱100', rake: 10, rakeMax: 500, jackpot: 20, createdAt: '2026-11-01T00:00:00Z' }), // cap went up
  S({ venue: 'City of Dreams', currency: 'PHP', game: 'NL ₱50/₱100', rake: 10, rakeMax: 400, createdAt: '2026-11-05T00:00:00Z', totalSeats: 8 }),
  S({ venue: 'Okada', currency: 'PHP', game: 'NL ₱100/₱200', rake: 10, rakeMax: 800, createdAt: '2026-10-20T00:00:00Z' }),
  S({ venue: 'Wynn', currency: 'USD', game: 'NL $1/$2', rake: null, createdAt: '2026-09-01T00:00:00Z' }),
];

describe('sessionProfiles', () => {
  const profiles = sessionProfiles(sessions);
  it('one profile per venue + currency + level, most recently used first', () => {
    expect(profiles.map(p => `${p.venue} | ${p.game}`)).toEqual([
      'City of Dreams | NL ₱50/₱100',
      'okada | NL ₱50/₱100',
      'Okada | NL ₱100/₱200',
      'Wynn | NL $1/$2',
    ]);
  });
  it('a profile always carries the latest settings (cap raised once → new cap)', () => {
    const okada = profiles.find(p => p.game === 'NL ₱50/₱100' && p.venue.toLowerCase() === 'okada');
    expect(okada).toMatchObject({ currency: 'PHP', totalSeats: 9, rakeType: 'percent', rake: 10, rakeMax: 500, jackpot: 20, timesPlayed: 2 });
  });
  it('keeps table size per profile', () => {
    expect(profiles[0].totalSeats).toBe(8);
  });
});

describe('profileSummary', () => {
  it('describes table, rake, cap and jackpot with the right symbol', () => {
    expect(profileSummary({ totalSeats: 9, currency: 'PHP', rakeType: 'percent', rake: 10, rakeMax: 500, jackpot: 20 }))
      .toBe('9-max · 10% cap ₱500 · JP ₱20');
    expect(profileSummary({ totalSeats: 6, currency: 'USD', rakeType: 'flat', rake: 5, rakeMax: 0, jackpot: 0 }))
      .toBe('6-max · $5 flat');
    expect(profileSummary({ totalSeats: 9, currency: 'USD', rake: null }))
      .toBe('9-max · no rake');
    expect(profileSummary({ totalSeats: 9, currency: 'PHP', rakeType: 'percent', rake: 5, rakeMax: 0, jackpot: 0 }))
      .toBe('9-max · 5% no cap');
  });
});
