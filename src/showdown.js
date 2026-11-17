// Showdown helpers: pure 7-card hand evaluator + pot winner suggestion.
// Cards are rank char + suit char, e.g. 'As', 'Td', '7c'.

const RANK_VALUE = {
  2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
}

const CATEGORY_NAMES = [
  'High Card', 'Pair', 'Two Pair', 'Trips', 'Straight',
  'Flush', 'Full House', 'Quads', 'Straight Flush',
]

function parseCard(card) {
  const rank = RANK_VALUE[card[0]]
  if (!rank || !'shdc'.includes(card[1])) throw new Error(`Bad card: ${card}`)
  return { rank, suit: card[1] }
}

// Highest straight top card in a set of distinct ranks (ace also plays low), or 0.
function straightHigh(rankSet) {
  for (let high = 14; high >= 5; high--) {
    let run = true
    for (let r = high; r > high - 5; r--) {
      // Rank 1 stands for the ace playing low (A-2-3-4-5, the wheel).
      if (!rankSet.has(r === 1 ? 14 : r)) { run = false; break }
    }
    if (run) return high
  }
  return 0
}

// Highest `n` ranks (with duplicates) among cards whose rank is not in `exclude`.
function kickers(ranks, exclude, n) {
  return ranks.filter((r) => !exclude.includes(r)).sort((a, b) => b - a).slice(0, n)
}

/**
 * Best five-card hand from 5-7 cards.
 * score = [category, ...tiebreakers]; compare lexicographically (bigger wins).
 */
export function evaluate7(cards) {
  if (!Array.isArray(cards) || cards.length < 5) throw new RangeError('Need at least 5 cards')
  const parsed = cards.map(parseCard)
  const ranks = parsed.map((p) => p.rank)

  const done = (score) => ({ score, name: CATEGORY_NAMES[score[0]] })

  // Flush suit (7 cards can hold at most one suit with 5+).
  const bySuit = {}
  for (const p of parsed) (bySuit[p.suit] ||= []).push(p.rank)
  const flushRanks = Object.values(bySuit).find((rs) => rs.length >= 5)

  if (flushRanks) {
    const sfHigh = straightHigh(new Set(flushRanks))
    if (sfHigh) return done([8, sfHigh])
  }

  // Rank groups, biggest count first, then highest rank.
  const counts = {}
  for (const r of ranks) counts[r] = (counts[r] || 0) + 1
  const groups = Object.entries(counts)
    .map(([r, n]) => ({ rank: Number(r), count: n }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank)
  const [g0, g1] = groups

  if (g0.count === 4) return done([7, g0.rank, ...kickers(ranks, [g0.rank], 1)])
  if (g0.count === 3 && g1 && g1.count >= 2) return done([6, g0.rank, g1.rank])
  if (flushRanks) return done([5, ...flushRanks.sort((a, b) => b - a).slice(0, 5)])

  const high = straightHigh(new Set(ranks))
  if (high) return done([4, high])

  if (g0.count === 3) return done([3, g0.rank, ...kickers(ranks, [g0.rank], 2)])
  if (g0.count === 2 && g1 && g1.count === 2) {
    return done([2, g0.rank, g1.rank, ...kickers(ranks, [g0.rank, g1.rank], 1)])
  }
  if (g0.count === 2) return done([1, g0.rank, ...kickers(ranks, [g0.rank], 3)])
  return done([0, ...kickers(ranks, [], 5)])
}

/** Lexicographic compare of two score arrays: 1 if a wins, -1 if b wins, 0 tie. */
export function compareScores(a, b) {
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x > y ? 1 : -1
  }
  return 0
}

/** Hand name for display; '' while fewer than five cards are known. */
export function describeHand(cards) {
  if (!Array.isArray(cards) || cards.length < 5) return ''
  return evaluate7(cards).name
}

const isCard = (x) => typeof x === 'string' && x.length === 2 && !!RANK_VALUE[x[0]] && 'shdc'.includes(x[1])

/** Keep only positions holding exactly two cards (opponent hole cards to persist). */
export function cleanOpponentCards(opp) {
  const out = {}
  for (const [pos, cards] of Object.entries(opp || {})) {
    if (Array.isArray(cards) && cards.length === 2 && cards.every(Boolean)) out[pos] = [...cards]
  }
  return out
}

/**
 * Suggest winners per pot. Needs a full 5-card board and both hole cards of
 * every eligible player in that pot; otherwise that pot's entry is null.
 * Never throws: duplicate or malformed cards make every pot null.
 */
export function suggestPotWinners({ board, holes, pots } = {}) {
  if (!Array.isArray(pots)) return []
  const none = pots.map(() => null)
  try {
    const boardFull = Array.isArray(board) && board.length === 5
    if (!boardFull || !board.every(isCard)) return none
    return pots.map((pot) => {
      const eligible = pot?.eligible || []
      if (eligible.length === 0) return null
      const known = eligible.every((pos) => Array.isArray(holes?.[pos]) && holes[pos].length === 2 && holes[pos].every(Boolean))
      if (!known) return null
      const used = [...board, ...eligible.flatMap((pos) => holes[pos])]
      if (!used.every(isCard) || new Set(used).size !== used.length) return null

      let best = null
      let winners = []
      for (const pos of eligible) {
        const result = evaluate7([...board, ...holes[pos]])
        const cmp = best ? compareScores(result.score, best.score) : 1
        if (cmp > 0) { best = result; winners = [pos] }
        else if (cmp === 0) winners.push(pos)
      }
      return { winners, name: best.name }
    })
  } catch {
    return none
  }
}
