import { describe, it, expect } from 'vitest';
import { computeRake, rakeProfileFor } from '../src/pots.js';
import { sessionProfiles, profileSummary } from '../src/utils.js';

describe('rake rounding', () => {
  const tenPctPer1000 = { rakeType: 'percent', rake: 10, rakeMax: 500, rakeRoundUnit: 100, rakeRoundMode: 'down' };
  const fivePctBy25 = { rakeType: 'percent', rake: 5, rakeMax: 0, rakeRoundUnit: 25, rakeRoundMode: 'nearest' };

  it('10%, ₱100 per full ₱1,000 (round down to 100)', () => {
    expect(computeRake(1950, false, tenPctPer1000).rake).toBe(100);
    expect(computeRake(999, false, tenPctPer1000).rake).toBe(0);
    expect(computeRake(2000, false, tenPctPer1000).rake).toBe(200);
    expect(computeRake(9000, false, tenPctPer1000).rake).toBe(500); // cap still applies
  });
  it('5% rounded to the nearest ₱25 (half up)', () => {
    expect(computeRake(1300, false, fivePctBy25).rake).toBe(75);  // 65 → 75
    expect(computeRake(1200, false, fivePctBy25).rake).toBe(50);  // 60 → 50
    expect(computeRake(1250, false, fivePctBy25).rake).toBe(75);  // 62.5 → 75
  });
  it('no rounding set → same as before (nearest whole number)', () => {
    expect(computeRake(13, false, { rakeType: 'percent', rake: 5 }).rake).toBe(1);
  });
  it('flat rake is not rounded', () => {
    expect(computeRake(1000, false, { rakeType: 'flat', rake: 30, rakeRoundUnit: 25, rakeRoundMode: 'nearest' }).rake).toBe(30);
  });
});

describe('rounding is part of the profile', () => {
  const sessions = [{ venue: 'Okada', currency: 'PHP', game: 'NL ₱50/₱100', totalSeats: 9, rakeType: 'percent', rake: 10, rakeMax: 500, jackpot: 20, rakeRoundUnit: 100, rakeRoundMode: 'down', createdAt: '2026-11-11T00:00:00Z' }];
  it('profiles and rake auto-fill carry it', () => {
    expect(sessionProfiles(sessions)[0]).toMatchObject({ rakeRoundUnit: 100, rakeRoundMode: 'down' });
    expect(rakeProfileFor(sessions, 'Okada', 'NL ₱50/₱100')).toMatchObject({ rakeRoundUnit: 100, rakeRoundMode: 'down' });
  });
  it('summary mentions it', () => {
    expect(profileSummary(sessionProfiles(sessions)[0])).toBe('9-max · 10% cap ₱500 · per ₱100 down · JP ₱20');
    expect(profileSummary({ totalSeats: 9, currency: 'PHP', rakeType: 'percent', rake: 5, rakeMax: 0, rakeRoundUnit: 25, rakeRoundMode: 'nearest' }))
      .toBe('9-max · 5% no cap · nearest ₱25');
  });
});
