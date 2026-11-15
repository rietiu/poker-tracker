import { describe, it, expect } from 'vitest';
import { clockOf, sessionStartFrom, handTimeFrom, formatWhen } from '../src/utils.js';

// Local-time dates so the tests pass in any timezone.
const local = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi);

describe('clockOf', () => {
  it('formats local HH:MM', () => {
    expect(clockOf(local(2026, 11, 15, 9, 5).toISOString())).toBe('09:05');
  });
  it('blank or invalid → empty', () => {
    expect(clockOf('')).toBe('');
    expect(clockOf(null)).toBe('');
    expect(clockOf('nope')).toBe('');
  });
});

describe('sessionStartFrom', () => {
  const now = local(2026, 11, 15, 21, 0);
  it('a time earlier today stays today', () => {
    expect(sessionStartFrom('19:30', now)).toBe(local(2026, 11, 15, 19, 30).toISOString());
  });
  it('a time in the future means it started last night', () => {
    const afterMidnight = local(2026, 11, 16, 1, 0);
    expect(sessionStartFrom('23:00', afterMidnight)).toBe(local(2026, 11, 15, 23, 0).toISOString());
  });
  it('blank → now', () => {
    expect(sessionStartFrom('', now)).toBe(now.toISOString());
  });
});

describe('handTimeFrom', () => {
  const start = local(2026, 11, 15, 20, 0).toISOString();
  it('same evening', () => {
    expect(handTimeFrom('21:15', start)).toBe(local(2026, 11, 15, 21, 15).toISOString());
  });
  it('past midnight rolls to the next day', () => {
    expect(handTimeFrom('00:40', start)).toBe(local(2026, 11, 16, 0, 40).toISOString());
  });
  it('slightly before the typed start time stays the same day', () => {
    expect(handTimeFrom('19:30', start)).toBe(local(2026, 11, 15, 19, 30).toISOString());
  });
  it('unknown → null', () => {
    expect(handTimeFrom('', start)).toBeNull();
  });
});

describe('formatWhen', () => {
  it('date plus clock', () => {
    expect(formatWhen(local(2026, 11, 15, 21, 5).toISOString())).toMatch(/15.*21:05$/);
    expect(formatWhen(null)).toBe('');
  });
});
