import { describe, it, expect } from 'vitest';
import { isMtt, currentLevel, totalInvested, entrySummary, bbCount, nextLevelDraft, handBlinds, chipSym, levelLabel, lastHandBlinds } from '../src/mtt.js';

const mtt = {
  kind: 'mtt', currency: 'PHP', game: '',
  buyIn: { prize: 4500, fee: 500 }, startingStack: 30000,
  entries: [
    { type: 'buyin', amount: 5000, chips: 30000, at: '2026-11-16T12:00:00Z' },
    { type: 'reentry', amount: 5000, chips: 30000, at: '2026-11-16T13:00:00Z' },
  ],
  levels: [
    { level: 1, sb: 100, bb: 200, ante: 200, at: '2026-11-16T12:00:00Z' },
    { level: 2, sb: 150, bb: 300, ante: 300, at: '2026-11-16T12:20:00Z' },
  ],
};
const cash = { currency: 'PHP', game: 'NL ₱25/₱50' };

describe('mtt helpers', () => {
  it('detects the kind; old sessions are cash', () => {
    expect(isMtt(mtt)).toBe(true);
    expect(isMtt(cash)).toBe(false);
    expect(isMtt({ kind: 'cash' })).toBe(false);
    expect(isMtt(null)).toBe(false);
  });
  it('current level is the last one', () => {
    expect(currentLevel(mtt)).toEqual({ level: 2, sb: 150, bb: 300, ante: 300 });
    expect(currentLevel(cash)).toBeNull();
  });
  it('totals what was paid in and summarises the entries', () => {
    expect(totalInvested(mtt)).toBe(10000);
    expect(entrySummary(mtt)).toBe('1 buy-in + 1 re-entry');
    expect(entrySummary({ entries: [{ type: 'buyin', amount: 1 }, { type: 'rebuy', amount: 1 }, { type: 'rebuy', amount: 1 }, { type: 'addon', amount: 1 }] }))
      .toBe('1 buy-in + 2 rebuys + 1 add-on');
    expect(totalInvested(cash)).toBe(0);
  });
  it('bb count to one decimal; null without a big blind', () => {
    expect(bbCount(18500, 400)).toBe(46.3);
    expect(bbCount(18500, 0)).toBeNull();
  });
  it('next level draft prefills the current level', () => {
    expect(nextLevelDraft(mtt)).toEqual({ sb: 150, bb: 300, ante: 300 });
  });
  it('hand blinds: the hand snapshot wins, then the current level, cash parses the game', () => {
    expect(handBlinds(mtt, { blinds: { level: 1, sb: 100, bb: 200, ante: 200 } })).toEqual({ sb: 100, bb: 200, ante: 200 });
    expect(handBlinds(mtt, {})).toEqual({ sb: 150, bb: 300, ante: 300 });
    expect(handBlinds(cash, {})).toEqual({ sb: 25, bb: 50, ante: 0 });
  });
  it('chips have no currency symbol in MTT', () => {
    expect(chipSym(mtt)).toBe('');
    expect(chipSym(cash)).toBe('₱');
  });
  it('level label', () => {
    expect(levelLabel({ level: 3, sb: 200, bb: 400, ante: 400 })).toBe('Lv3 200/400 (400)');
    expect(levelLabel({ level: 1, sb: 100, bb: 200, ante: 0 })).toBe('Lv1 100/200');
  });
  it('level label without a level omits Lv', () => {
    expect(levelLabel({ sb: 200, bb: 400, ante: 400 })).toBe('200/400 (400)');
    expect(levelLabel({ sb: 100, bb: 200, ante: 0 })).toBe('100/200');
  });
  it('last hand blinds: latest hand with blinds, else old levels, else blank', () => {
    const hands = [
      { handNum: 1, blinds: { sb: 100, bb: 200, ante: 200 } },
      { handNum: 3, blinds: { sb: 200, bb: 400, ante: 400, level: 4 } },
      { handNum: 4 },
    ];
    expect(lastHandBlinds(mtt, hands)).toEqual({ sb: 200, bb: 400, ante: 400 });
    expect(lastHandBlinds(mtt, [])).toEqual({ sb: 150, bb: 300, ante: 300 });
    expect(lastHandBlinds({ kind: 'mtt' }, [])).toEqual({ sb: '', bb: '', ante: '' });
    const byTime = [
      { createdAt: '2026-11-16T12:00:00Z', blinds: { sb: 1, bb: 2, ante: 0 } },
      { createdAt: '2026-11-16T13:00:00Z', blinds: { sb: 3, bb: 6, ante: 0 } },
    ];
    expect(lastHandBlinds({ kind: 'mtt' }, byTime)).toEqual({ sb: 3, bb: 6, ante: 0 });
  });
  it('hand blinds fall back to {0,0,0} with nothing', () => {
    expect(handBlinds({ kind: 'mtt' }, {})).toEqual({ sb: 0, bb: 0, ante: 0 });
  });
});
