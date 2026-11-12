// Pots, side pots and rake — pure helpers over a hand's recorded actions.
import { computeStreetState, formatGame } from './utils.js';

const STREETS = ['preflop', 'flop', 'turn', 'river'];
const round2 = (n) => Math.round(n * 100) / 100;

// Positions that folded on any street.
export function foldedPositions(hand) {
  const out = new Set();
  for (const st of STREETS) {
    for (const a of hand?.[st]?.actions || []) if (a.action === 'fold') out.add(a.pos);
  }
  return out;
}

// Chips each position put in over the whole hand (posted blinds included).
export function handContributions(hand, sb = 1, bb = 2) {
  const total = {};
  for (const st of STREETS) {
    const actions = hand?.[st]?.actions || [];
    const isPre = st === 'preflop';
    const order = [...new Set([...(isPre ? ['SB', 'BB'] : []), ...actions.map(a => a.pos)])];
    if (order.length === 0) continue;
    const { committed } = computeStreetState(actions, order, order, 0, isPre ? { SB: sb, BB: bb } : {});
    for (const pos of order) total[pos] = (total[pos] || 0) + (committed[pos] || 0);
  }
  return total;
}

// True when the pot was taken pre-flop (everyone else folded) — no rake, no jackpot.
export function endedPreflop(hand) {
  const actions = hand?.preflop?.actions || [];
  const dealt = new Set(['SB', 'BB', ...actions.map(a => a.pos)]);
  const folded = new Set(actions.filter(a => a.action === 'fold').map(a => a.pos));
  return [...dealt].filter(p => !folded.has(p)).length <= 1;
}

// contributions: { pos: chips }, folded: Set of folded positions.
// Returns { pots: [{ amount, eligible: [pos] }], uncalled: { pos, amount } | null }.
// Main pot first. The part of the biggest contribution nobody matched is
// returned to that player (uncalled), not put in a pot.
export function buildPots(contributions, folded) {
  const contrib = { ...contributions };
  const players = Object.keys(contrib);

  let uncalled = null;
  const sorted = [...players].sort((a, b) => contrib[b] - contrib[a]);
  if (sorted.length && !folded.has(sorted[0])) {
    const top = contrib[sorted[0]];
    const second = sorted.length > 1 ? contrib[sorted[1]] : 0;
    if (top > second) {
      uncalled = { pos: sorted[0], amount: round2(top - second) };
      contrib[sorted[0]] = second;
    }
  }

  const live = players.filter(p => !folded.has(p));
  const levels = [...new Set(live.map(p => contrib[p]).filter(v => v > 0))].sort((a, b) => a - b);
  const pots = [];
  let prev = 0;
  levels.forEach((level, i) => {
    const isLast = i === levels.length - 1;
    let amount = 0;
    for (const p of players) {
      const c = contrib[p];
      // folded chips above the top live level still belong in the last pot
      const cap = isLast ? Math.max(c, level) : level;
      amount += Math.max(0, Math.min(c, cap) - Math.min(c, prev));
    }
    const eligible = live.filter(p => contrib[p] >= level).sort();
    const last = pots[pots.length - 1];
    if (last && last.eligible.join() === eligible.join()) last.amount = round2(last.amount + amount);
    else if (amount > 0) pots.push({ amount: round2(amount), eligible });
    prev = level;
  });

  return { pots, uncalled };
}

// cfg: { rakeType: 'percent' | 'flat', rake, rakeMax, jackpot, rakeRoundUnit, rakeRoundMode }.
// Percent rake can be rounded in steps, e.g. 10% taken as ₱100 per full ₱1,000
// (unit 100, 'down') or 5% rounded to the nearest ₱25 (unit 25, 'nearest').
export function computeRake(calledPot, preflopOnly, cfg) {
  const none = { rake: 0, jackpot: 0, total: 0 };
  if (!cfg || preflopOnly || !(calledPot > 0)) return none;
  let rake = 0;
  const r = Number(cfg.rake) || 0;
  if (r > 0) {
    if ((cfg.rakeType || 'flat') === 'percent') {
      const raw = calledPot * r / 100;
      const unit = Number(cfg.rakeRoundUnit) || 0;
      if (unit > 0) {
        const steps = raw / unit + 1e-9; // guard float noise (e.g. 2.4999999)
        rake = (cfg.rakeRoundMode === 'down' ? Math.floor(steps) : Math.floor(steps + 0.5)) * unit;
      } else {
        rake = Math.round(raw);
      }
      if (Number(cfg.rakeMax) > 0) rake = Math.min(rake, Number(cfg.rakeMax));
    } else {
      rake = r;
    }
  }
  rake = Math.min(rake, calledPot);
  const jackpot = Math.min(Number(cfg.jackpot) || 0, calledPot - rake);
  return { rake, jackpot, total: rake + jackpot };
}

// Chips pushed to `hero`: pots won (rake + jackpot come out of the main pot
// first; split pots divide evenly) plus hero's own uncalled chips.
export function heroTake(potsWithWinners, hero, rakeTotal = 0, uncalled = null) {
  let toTake = rakeTotal;
  let take = 0;
  for (const pot of potsWithWinners || []) {
    const cut = Math.min(toTake, pot.amount);
    toTake -= cut;
    const winners = pot.winners || [];
    if (winners.includes(hero)) take += (pot.amount - cut) / winners.length;
  }
  if (uncalled && uncalled.pos === hero) take += uncalled.amount;
  return round2(take);
}

// Rake settings depend on venue and stakes. Latest session with the same
// venue + game (trimmed, case-insensitive) → its rake settings, else null.
export function rakeProfileFor(sessions, venue, game) {
  const norm = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const v = norm(venue), g = norm(game);
  if (!v || !g) return null;
  const match = (sessions || [])
    .filter(s => norm(s.venue) === v && s.rake != null &&
      (norm(s.game) === g || norm(formatGame(s.game, s.currency || 'USD')) === g))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  if (!match) return null;
  return {
    rakeType: match.rakeType || 'percent',
    rake: match.rake,
    rakeMax: match.rakeMax || 0,
    jackpot: match.jackpot || 0,
    rakeRoundUnit: match.rakeRoundUnit || 0,
    rakeRoundMode: match.rakeRoundMode || 'nearest',
  };
}
