import { describe, it, expect } from 'vitest';
import { generateHandText, hasShowdownData } from '../src/share.js';

const A = (pos, action, amount = 0) => ({ pos, action, amount });
const session = { game: '1/2', currency: 'USD', venue: 'Home' };
// Hero BTN Ah Kh; opp BB Qh Qd; board Qs 7h 2h 9h 3c -> hero flush, opp trips
const hand = {
  handNum: 7,
  myPosition: 'BTN',
  holeCards: ['Ah', 'Kh'],
  opponentCards: { BB: ['Qh', 'Qd'] },
  preflop: { actions: [A('BTN', 'raise', 6), A('BB', 'call', 6)], pot: 12 },
  flop: { cards: ['Qs', '7h', '2h'], actions: [A('BB', 'check'), A('BTN', 'bet', 8), A('BB', 'call', 8)], pot: 28 },
  turn: { card: '9h', actions: [A('BB', 'check'), A('BTN', 'check')], pot: 28 },
  river: { card: '3c', actions: [A('BB', 'check'), A('BTN', 'bet', 20), A('BB', 'call', 20)], pot: 28 },
  result: { outcome: 'won', amount: 68, winner: 'BTN', notes: '' },
};

describe('share showdown toggle', () => {
  it('detects showdown data', () => {
    expect(hasShowdownData(hand)).toBe(true);
    expect(hasShowdownData({ ...hand, opponentCards: undefined, result: { outcome: 'won', amount: 5 } })).toBe(false);
    expect(hasShowdownData({ ...hand, opponentCards: {}, result: { outcome: 'lost', amount: 5, winner: 'BB' } })).toBe(true);
    expect(hasShowdownData({ ...hand, opponentCards: {}, result: { outcome: 'folded', winner: 'BB' } })).toBe(false);
    expect(hasShowdownData({ ...hand, opponentCards: {}, result: { outcome: 'won', amount: 5, winner: 'BTN' } })).toBe(false);
  });

  for (const lang of ['en', 'zh']) {
    it(`included (${lang}): shows opponent cards, hand types and result`, () => {
      const t = generateHandText(hand, session, lang, { includeShowdown: true });
      expect(t).toContain('BB Q♥ Q♦');
      expect(t).toContain('Flush');
      expect(t).toContain('Trips');
      expect(t).toMatch(/Won|贏得/);
    });

    it(`excluded (${lang}): no opponent cards, hand types, winner or result line`, () => {
      const t = generateHandText({ ...hand, result: { ...hand.result, outcome: 'lost', winner: 'BB' } }, session, lang, { includeShowdown: false });
      expect(t).not.toContain('Q♥');
      expect(t).not.toContain('Q♦');
      expect(t).not.toMatch(/Flush|Trips|Opponents|對手手牌|Hand types|牌型/);
      expect(t).not.toMatch(/Won|Lost|Split|贏得|輸掉|平分|winner|贏家/);
      expect(t).not.toContain('68');
      // hero cards, board and actions stay
      expect(t).toContain('A♥ K♥');
      expect(t).toContain('Q♠ 7♥ 2♥');
      expect(t).toContain('9♥');
      expect(t).toContain('3♣');
      expect(t).toMatch(/raise|加注/);
    });
  }

  it('excluded keeps notes and folded outcome', () => {
    const t = generateHandText({ ...hand, result: { outcome: 'folded', notes: 'tough spot' } }, session, 'en', { includeShowdown: false });
    expect(t).toContain('Folded');
    expect(t).toContain('tough spot');
  });

  it('no-showdown hand is identical in both modes', () => {
    const plain = { ...hand, opponentCards: undefined, result: { outcome: 'won', amount: 40 } };
    expect(generateHandText(plain, session, 'en', { includeShowdown: false }).replace('── Result\n', '').includes('Won')).toBe(false);
    expect(generateHandText(plain, session, 'en')).toContain('Won');
  });
});
