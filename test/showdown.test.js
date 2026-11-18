import { describe, it, expect } from 'vitest'
import { evaluate7, compareScores, suggestPotWinners, describeHand, cleanOpponentCards, showdownHandNames } from '../src/showdown.js'

const c = (s) => s.split(' ')

describe('evaluate7 categories and names', () => {
  const cases = [
    ['High Card', 'As Kd 9c 7h 3s 2d 4c', [0, 14, 13, 9, 7, 4]],
    ['Pair', 'As Ad 9c 7h 3s 2d 4c', [1, 14, 9, 7, 4]],
    ['Two Pair', 'As Ad 9c 9h 3s 2d 4c', [2, 14, 9, 4]],
    ['Trips', 'As Ad Ac 9h 3s 2d 4c', [3, 14, 9, 4]],
    ['Straight', '5s 6d 7c 8h 9s 2d Kc', [4, 9]],
    ['Straight', 'As 2d 3c 4h 5s 9d Kc', [4, 5]], // wheel
    ['Flush', 'As 9s 7s 5s 3s Kd Kc', [5, 14, 9, 7, 5, 3]],
    ['Full House', 'As Ad Ac 9h 9s 2d 4c', [6, 14, 9]],
    ['Quads', 'As Ad Ac Ah 9s 2d 4c', [7, 14, 9]],
    ['Straight Flush', '5h 6h 7h 8h 9h 2d Kc', [8, 9]],
    ['Straight Flush', 'Th Jh Qh Kh Ah 2d 3c', [8, 14]], // royal
    ['Straight Flush', 'Ah 2h 3h 4h 5h Kd Kc', [8, 5]], // steel wheel
  ]
  for (const [name, hand, score] of cases) {
    it(`${hand} -> ${name}`, () => {
      const r = evaluate7(c(hand))
      expect(r.name).toBe(name)
      expect(r.score).toEqual(score)
    })
  }

  it('accepts 5 and 6 cards', () => {
    expect(evaluate7(c('As Ks Qs Js Ts')).name).toBe('Straight Flush')
    expect(evaluate7(c('As Ad 2c 2d 5h 9s')).score).toEqual([2, 14, 2, 9])
  })

  it('throws with fewer than five cards', () => {
    expect(() => evaluate7(c('As Ad 2c 2d'))).toThrow()
  })

  it('does not wrap the straight around the ace (Q-K-A-2-3)', () => {
    expect(evaluate7(c('Qs Kd Ah 2c 3d 7c 8d')).name).toBe('High Card')
  })

  it('takes the two-pair kicker from a third pair', () => {
    expect(evaluate7(c('Ks Kd 7c 7h 3s 3d 2s')).score).toEqual([2, 13, 7, 3])
  })

  it('two trips make a full house with the lower trips as the pair', () => {
    expect(evaluate7(c('9s 9d 9c 4h 4s 4d Kc')).score).toEqual([6, 9, 4])
  })

  it('quads kicker is the best remaining card even if it is a pair', () => {
    expect(evaluate7(c('9s 9d 9c 9h Ks Kd 2c')).score).toEqual([7, 9, 13])
  })

  it('a flush with a separate straight is a flush, not a straight flush', () => {
    expect(evaluate7(c('2h 5h 6h 7h 8h 9d Kc')).name).toBe('Flush')
  })
})

// Each row: [label, board, handA, handB, expected 'A' | 'B' | 'tie']
const duels = [
  ['pair beats high card', '2c 5h 9s Jd 3c', 'As Kd', '9h 4d', 'B'],
  ['pair kicker', 'Ks 7d 4c 2h 9s', 'Kd Ah', 'Kc Qh', 'A'],
  ['higher pair', 'Ks 7d 4c 2h 9s', '9d 3h', '7h 3d', 'A'],
  ['two pair beats pair', 'Ks 7d 4c 2h 9s', 'Kd 7h', 'Kc Ah', 'A'],
  ['two pair top pair decides', 'Ks 7d 4c 2h 9s', 'Kd 4h', '9d 7h', 'A'],
  ['two pair kicker (board plays pairs)', 'Ks Kd 7c 7h 2s', 'Ac 3d', 'Qc 4d', 'A'],
  ['two pair kicker from third pair', 'Ks Kd 7c 7h 2s', '3c 3d', '5c 4d', 'B'],
  ['trips beat two pair', 'Ks 7d 4c 2h 9s', 'Kd Kc', '7h 4d', 'A'],
  ['trips kicker', 'Ks Kd 7c 2h 9s', 'Kc Ah', 'Kh Qd', 'A'],
  ['straight beats trips', '5c 6d 7h Kd 2s', '8c 9d', 'Kc Kh', 'A'],
  ['higher straight wins', '5c 6d 7h Kd 2s', '8c 9d', '4c 8d', 'A'],
  ['wheel loses to six-high straight', '2d 3h 4c 9s Kd', 'Ac 5d', '5h 6d', 'B'],
  ['wheel beats trips', '2d 3h 4c 9s 9h', 'Ac 5d', '9c Kd', 'A'],
  ['no wraparound: ace-high cards compare normally', 'Qs Kd Ah 2c 3d', '7c 8d', '5c 6d', 'A'],
  ['broadway beats king-high straight', 'Td Jh Qc 2s 3d', 'Ks Ac', 'Ks 9d', 'A'],
  ['best five of seven straight', '5c 6d 7h 8s 2c', '4c 3d', '9c Kd', 'B'],
  ['flush beats straight', '5h 6h 7h Kd 2c', '8h 2h', '8c 9d', 'A'],
  ['flush top card', '2h 5h 9h Kd 3c', 'Ah 3h', 'Qh Jh', 'A'],
  ['flush second card', '2h 5h 9h Kh 3c', 'Qh 4h', 'Qd 7h', 'A'],
  ['flush fifth card', 'Ah Kh 9h 5h 8c', '4h 3d', '3h 2d', 'A'],
  ['seven-card flush uses best five', '2s 5s 9s Kd 3c', 'As 7s', 'Ks 4s', 'A'],
  ['full house beats flush', '9h 9d 4h 7h Kh', '9s 4c', 'Ah 2h', 'A'],
  ['full house trips rank first', '9h 9d Ks 4c 4d', '9c Kd', '4h Kc', 'A'],
  ['full house pair rank second', '9h 9d 9s Kc 4d', 'Kd 2c', '4c 2d', 'A'],
  ['quads beat full house', '9h 9d 9s Kc Kd', '9c 2h', 'Kh 3c', 'A'],
  ['quads kicker', '9h 9d 9s 9c 2d', 'Ah 3c', 'Kh Qc', 'A'],
  ['higher quads win', '7h 7d 2c 2d 2h', '7s 7c', '2s 3c', 'A'],
  ['straight flush beats quads', '5h 6h 7h 8h 8d', '9h 2c', '8c 8s', 'A'],
  ['royal beats lower straight flush', 'Th Jh Qh 9h 2c', 'Kh Ah', '8h 2d', 'A'],
  ['steel wheel beats flush', 'Ah 2h 3h 4h Kd', '5h 9c', 'Kh 5c', 'A'],
  ['high card fifth kicker', 'As Kd Qc 9h 3s', '7c 2d', '6c 2h', 'A'],
  ['board plays: broadway tie', 'As Kd Qc Jh Ts', '2c 3d', '4h 5d', 'tie'],
  ['board plays: high card tie', 'As Kd Qc Jh 9s', '2c 3d', '4h 5s', 'tie'],
  ['same pair, same kickers tie', 'Ks Kd 9c 5h 2s', 'Ac 3d', 'Ad 4h', 'tie'],
  ['suits never break ties', '2h 5h 9d Kc 3s', 'Ah Qd', 'As Qc', 'tie'],
]

describe('hand duels', () => {
  for (const [label, board, a, b, expected] of duels) {
    it(label, () => {
      const sa = evaluate7([...c(board), ...c(a)]).score
      const sb = evaluate7([...c(board), ...c(b)]).score
      const r = compareScores(sa, sb)
      expect(r).toBe(expected === 'A' ? 1 : expected === 'B' ? -1 : 0)
      expect(compareScores(sb, sa) + r).toBe(0)
    })
  }
  it('has at least 25 duels', () => {
    expect(duels.length).toBeGreaterThanOrEqual(25)
  })
})

describe('compareScores', () => {
  it('compares lexicographically', () => {
    expect(compareScores([1, 9], [1, 8])).toBe(1)
    expect(compareScores([1, 8], [1, 9])).toBe(-1)
    expect(compareScores([2, 1], [1, 14, 14])).toBe(1)
    expect(compareScores([3, 4], [3, 4])).toBe(0)
  })
})

describe('describeHand', () => {
  it('matches evaluate7 name', () => {
    expect(describeHand(c('As Ad 9c 9h 3s 2d 4c'))).toBe('Two Pair')
  })
  it('returns empty string with fewer than five cards', () => {
    expect(describeHand(c('As Ad'))).toBe('')
  })
})

describe('suggestPotWinners', () => {
  const board = c('As Ad 2c 7h 9d')
  it('returns all null when board has fewer than 5 cards', () => {
    const r = suggestPotWinners({
      board: c('As Ad 2c 7h'),
      holes: { BTN: c('Ks Kd'), BB: c('Qs Qd') },
      pots: [{ eligible: ['BTN', 'BB'] }, { eligible: ['BTN'] }],
    })
    expect(r).toEqual([null, null])
  })
  it('returns null when any eligible hole is unknown or incomplete', () => {
    const r = suggestPotWinners({
      board,
      holes: { BTN: c('Ks Kd'), BB: ['Qs'] },
      pots: [{ eligible: ['BTN', 'BB'] }, { eligible: ['BTN', 'SB'] }],
    })
    expect(r).toEqual([null, null])
  })
  it('picks a single winner with the winning hand name', () => {
    const r = suggestPotWinners({
      board,
      holes: { BTN: c('Ks Kd'), BB: c('Qs Qd') },
      pots: [{ eligible: ['BTN', 'BB'] }],
    })
    expect(r).toEqual([{ winners: ['BTN'], name: 'Two Pair' }])
  })
  it('resolves side pots with different eligible sets', () => {
    const r = suggestPotWinners({
      board,
      holes: { BTN: c('Ks Kd'), BB: c('Qs Qd'), SB: c('9c 9h') },
      pots: [{ eligible: ['BTN', 'BB', 'SB'] }, { eligible: ['BTN', 'BB'] }],
    })
    expect(r[0]).toEqual({ winners: ['SB'], name: 'Full House' })
    expect(r[1]).toEqual({ winners: ['BTN'], name: 'Two Pair' })
  })
  it('lists every winner on a tie (multi-way board plays)', () => {
    const r = suggestPotWinners({
      board: c('As Kd Qc Jh Ts'),
      holes: { BTN: c('2c 3d'), BB: c('4h 5s'), SB: c('6c 7d'), UTG: c('Ac 9d') },
      pots: [{ eligible: ['BTN', 'BB', 'SB'] }, { eligible: ['BTN', 'BB', 'SB', 'UTG'] }],
    })
    expect(r[0]).toEqual({ winners: ['BTN', 'BB', 'SB'], name: 'Straight' })
    expect(r[1]).toEqual({ winners: ['BTN', 'BB', 'SB', 'UTG'], name: 'Straight' })
  })
  it('returns null for an empty eligible list', () => {
    expect(suggestPotWinners({ board, holes: {}, pots: [{ eligible: [] }] })).toEqual([null])
  })
})

describe('suggestPotWinners hardening', () => {
  const board = c('As Kd 7c 7h 2s')
  const pots = [{ eligible: ['BTN', 'BB'] }]
  it('returns null on a card duplicated across hole and board', () => {
    expect(suggestPotWinners({ board, holes: { BTN: c('As Qd'), BB: c('Jc Jd') }, pots })).toEqual([null])
  })
  it('returns null on duplicate hole cards between players', () => {
    expect(suggestPotWinners({ board, holes: { BTN: c('Qs Qd'), BB: c('Qd Jd') }, pots })).toEqual([null])
  })
  it('returns null on a duplicate within the board or within one hand', () => {
    expect(suggestPotWinners({ board: c('As Kd 7c 7h As'), holes: { BTN: c('Qs Qd'), BB: c('Jc Jd') }, pots })).toEqual([null])
    expect(suggestPotWinners({ board, holes: { BTN: c('Qs Qs'), BB: c('Jc Jd') }, pots })).toEqual([null])
  })
  it('never throws on malformed or non-string cards', () => {
    for (const bad of [['Zz', 'Qd'], [null, 'Qd'], [12, 'Qd'], ['', 'Qd'], ['Q', 'Qd'], [{}, 'Qd']]) {
      expect(() => suggestPotWinners({ board, holes: { BTN: bad, BB: c('Jc Jd') }, pots })).not.toThrow()
      expect(suggestPotWinners({ board, holes: { BTN: bad, BB: c('Jc Jd') }, pots })).toEqual([null])
    }
    expect(suggestPotWinners({ board: [1, 2, 3, 4, 5], holes: { BTN: c('Qs Qd'), BB: c('Jc Jd') }, pots })).toEqual([null])
    expect(suggestPotWinners({ board, holes: { BTN: c('Qs Qd'), BB: c('Jc Jd') }, pots: null })).toEqual([])
  })
})

describe('cleanOpponentCards', () => {
  it('keeps only positions with exactly two cards', () => {
    expect(cleanOpponentCards({ BTN: c('As Kd'), BB: ['Qs', null], SB: [null, null], CO: ['Qs'] })).toEqual({ BTN: c('As Kd') })
  })
  it('handles missing input', () => {
    expect(cleanOpponentCards(undefined)).toEqual({})
  })
})

describe('showdownHandNames', () => {
  const board = c('2h 7h Jh 9c Kd')
  it('names every hand when board and all cards are known', () => {
    const r = showdownHandNames({ board, heroHole: c('Ah 3h'), myPosition: 'BB', opponentCards: { BTN: c('Ks Kc') } })
    expect(r.map(x => x.pos)).toEqual(['BTN', 'BB'])
    expect(r[0].name).toMatch(/trips/i)
    expect(r[1].name).toMatch(/flush/i)
  })
  it('returns null when the board is incomplete, a card is missing or duplicated', () => {
    const opp = { BTN: c('Ks Kc') }
    expect(showdownHandNames({ board: board.slice(0, 4), heroHole: c('Ah 3h'), myPosition: 'BB', opponentCards: opp })).toBeNull()
    expect(showdownHandNames({ board, heroHole: c('Ah 3h'), myPosition: 'BB', opponentCards: { BTN: ['Ks', null] } })).toBeNull()
    expect(showdownHandNames({ board, heroHole: c('Ks 3h'), myPosition: 'BB', opponentCards: opp })).toBeNull()
    expect(showdownHandNames()).toBeNull()
  })
})
