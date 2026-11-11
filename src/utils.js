// UUID
export function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Format card string like 'Ah' → 'A♥'
const SUIT_MAP = { h: '♥', d: '♦', c: '♣', s: '♠' };
export function formatCard(card) {
  if (!card || card.length < 2) return card;
  const rank = card.slice(0, -1);
  const suit = SUIT_MAP[card.slice(-1)] || card.slice(-1);
  return rank + suit;
}

export function cardSuit(card) {
  return card ? card.slice(-1) : '';
}

export function isRedCard(card) {
  const s = cardSuit(card);
  return s === 'h' || s === 'd';
}

// Format money
export function formatMoney(amount) {
  if (amount === null || amount === undefined) return '';
  const n = Number(amount);
  if (n >= 0) return `+${n.toLocaleString()}`;
  return n.toLocaleString();
}

// Calculate position given totalSeats, mySeat (1-indexed), buttonSeat (1-indexed)
// Returns position string: 'BTN'|'SB'|'BB'|'EP'|'MP'|'HJ'|'CO'
export function calcPosition(totalSeats, mySeat, buttonSeat) {
  if (!mySeat || !buttonSeat || !totalSeats) return '';

  // offset from button (0 = BTN, 1 = SB, 2 = BB, ...)
  const offset = ((mySeat - buttonSeat + totalSeats) % totalSeats);

  if (offset === 0) return 'BTN';
  if (offset === 1) return 'SB';
  if (offset === 2) return 'BB';

  // Remaining positions depend on table size
  // Positions counted from BTN going left: BTN=0, SB=1, BB=2, ...EP last
  // For 6-max: BTN CO HJ MP EP SB BB  → 5 non-blind non-btn = CO(5) HJ(4) MP(3) EP(?)
  // Map offset to position name
  // Names match TABLE_POSITIONS so History filters / badges line up.
  if (totalSeats === 6) {
    // offsets: 0=BTN,1=SB,2=BB,3=UTG,4=HJ,5=CO
    const map = { 3: 'UTG', 4: 'HJ', 5: 'CO' };
    return map[offset] || 'MP';
  }
  if (totalSeats === 8) {
    // 0=BTN,1=SB,2=BB,3=UTG,4=UTG+1,5=LJ,6=HJ,7=CO
    const map = { 3: 'UTG', 4: 'UTG+1', 5: 'LJ', 6: 'HJ', 7: 'CO' };
    return map[offset] || 'MP';
  }
  if (totalSeats === 9) {
    // 0=BTN,1=SB,2=BB,3=UTG,4=UTG+1,5=MP,6=LJ,7=HJ,8=CO
    const map = { 3: 'UTG', 4: 'UTG+1', 5: 'MP', 6: 'LJ', 7: 'HJ', 8: 'CO' };
    return map[offset] || 'MP';
  }
  // fallback
  const positions = ['BTN', 'SB', 'BB', 'UTG', 'MP', 'HJ', 'CO'];
  return positions[Math.min(offset, positions.length - 1)];
}

export const POSITION_COLORS = {
  BTN: '#f4c430',
  SB: '#5b8dee',
  BB: '#4dabf7',
  CO: '#69db7c',
  HJ: '#a9e34b',
  MP: '#adb5bd',
  LJ: '#cc9a06',
  EP: '#868e96',
  UTG: '#868e96',
  'UTG+1': '#868e96',
};

export const TABLE_POSITIONS = {
  6: ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'],
  8: ['SB', 'BB', 'UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN'],
  9: ['SB', 'BB', 'UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN'],
};

// Every distinct position across table sizes, ordered late -> early then blinds.
// History's position filter uses this so UTG / LJ / UTG+1 hands are filterable
// (the old hard-coded list used EP/MP names that no recorded hand ever has).
export const HISTORY_FILTER_POSITIONS = ['BTN', 'CO', 'HJ', 'LJ', 'MP', 'UTG+1', 'UTG', 'SB', 'BB'];

export const PREFLOP_ACTION_ORDER = {
  6: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  8: ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  9: ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
};

export const POSTFLOP_ACTION_ORDER = {
  6: ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'],
  8: ['SB', 'BB', 'UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN'],
  9: ['SB', 'BB', 'UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN'],
};

// Blinds from a game label in any currency: "NL $1/$2", "PLO ₱25/₱50",
// "NL ₫50,000/₫100,000", "NL RM5/RM10", "NL S$2/S$4" (commas = thousands).
function parseBlinds(gameStr) {
  const m = gameStr?.match(/(\d[\d,]*(?:\.\d+)?)\s*\/\s*\D*?(\d[\d,]*(?:\.\d+)?)/);
  if (!m) return null;
  const num = (x) => parseFloat(x.replace(/,/g, ''));
  return { sb: num(m[1]), bb: num(m[2]) };
}

export function parseBB(gameStr) {
  return parseBlinds(gameStr)?.bb ?? 2;
}

export function parseSB(gameStr) {
  return parseBlinds(gameStr)?.sb ?? 1;
}

// ── Currencies ────────────────────────────────────────────────────────────────
// PHP + USD + common SE Asian poker currencies + HKD/MOP. EUR/GBP kept for old sessions.
export const CURRENCIES = [
  { code: 'PHP', symbol: '₱', name: 'Philippine peso' },
  { code: 'USD', symbol: '$', name: 'US dollar' },
  { code: 'THB', symbol: '฿', name: 'Thai baht' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese dong' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian ringgit' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore dollar' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong dollar' },
  { code: 'MOP', symbol: 'MOP$', name: 'Macau pataca' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British pound' },
];

export function currencySymbol(code) {
  if (!code) return '$';
  const c = CURRENCIES.find(x => x.code === code);
  return c ? c.symbol : `${code} `;
}

// +₱1,200 / −$40
export function formatSigned(amount, code) {
  const n = Number(amount) || 0;
  return `${n < 0 ? '−' : '+'}${currencySymbol(code)}${Math.abs(n).toLocaleString()}`;
}

// [{ currency, amount }] → { PHP: n, USD: m } — different currencies are never added together.
export function sumByCurrency(entries) {
  const out = {};
  for (const { currency, amount } of entries || []) {
    const code = currency || 'USD';
    out[code] = (out[code] || 0) + (Number(amount) || 0);
  }
  return out;
}

export function formatTotals(totals) {
  const codes = Object.keys(totals || {});
  if (codes.length === 0) return '+0';
  return codes.map(c => formatSigned(totals[c], c)).join(' · ');
}

// ── Game / blinds label ───────────────────────────────────────────────────────
// Blinds are always shown with the session's currency symbol, whatever was
// typed (e.g. "NL P25/P50" for pesos → "NL ₱25/₱50").
export function buildGame(type, sb, bb, currency) {
  if (sb === '' || bb === '' || sb == null || bb == null) return '';
  const n1 = Number(sb), n2 = Number(bb);
  if (!(n1 > 0) || !(n2 > 0)) return '';
  const sym = currencySymbol(currency);
  const f = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return `${type || 'NL'} ${sym}${f(n1)}/${sym}${f(n2)}`;
}

export function formatGame(game, currency) {
  const g = (game || '').trim();
  const blinds = parseBlinds(g);
  if (!blinds) return g;
  const m = g.match(/^\s*(PLO|NLH|NL|PL|FL|LHE)\b/i);
  const type = m ? (m[1].toUpperCase() === 'NLH' ? 'NL' : m[1].toUpperCase()) : 'NL';
  return buildGame(type, blinds.sb, blinds.bb, currency);
}

// Blind levels played in `currency`, most recent first, one per level.
export function recentGames(sessions, currency) {
  const shown = (sessions || []).map(s => ({ ...s, game: formatGame(s.game, s.currency || 'USD') }));
  return recentValues(shown, 'game', s => (s.currency || 'USD') === currency);
}

// ── Session profiles ──────────────────────────────────────────────────────────
// Every venue + currency + blind level played becomes a profile carrying the
// settings of its most recent session (table size, rake, cap, jackpot), so a
// changed cap only has to be entered once. Most recently used first.
export function sessionProfiles(sessions) {
  const norm = (v) => (v || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const sorted = [...(sessions || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const byKey = new Map();
  for (const s of sorted) {
    const currency = s.currency || 'USD';
    const game = formatGame(s.game, currency);
    if (!game) continue;
    const key = `${norm(s.venue)}|${currency}|${norm(game)}`;
    const seen = byKey.get(key);
    if (seen) { seen.timesPlayed += 1; continue; }
    byKey.set(key, {
      key,
      venue: (s.venue || '').trim(),
      currency,
      game,
      totalSeats: s.totalSeats || 9,
      rakeType: s.rakeType || 'percent',
      rake: s.rake ?? null,
      rakeMax: s.rakeMax || 0,
      jackpot: s.jackpot || 0,
      lastUsed: s.createdAt,
      timesPlayed: 1,
    });
  }
  return [...byKey.values()];
}

// "9-max · 10% cap ₱500 · JP ₱20"
export function profileSummary(p) {
  const sym = currencySymbol(p.currency);
  const parts = [`${p.totalSeats || 9}-max`];
  if (p.rake == null || p.rake === '') {
    parts.push('no rake');
  } else if ((p.rakeType || 'percent') === 'percent') {
    parts.push(`${p.rake}% ${Number(p.rakeMax) > 0 ? `cap ${sym}${Number(p.rakeMax).toLocaleString('en-US')}` : 'no cap'}`);
  } else {
    parts.push(`${sym}${Number(p.rake).toLocaleString('en-US')} flat`);
  }
  if (Number(p.jackpot) > 0) parts.push(`JP ${sym}${Number(p.jackpot).toLocaleString('en-US')}`);
  return parts.join(' · ');
}

export function getSbSeat(buttonSeat, totalSeats) {
  return (buttonSeat % totalSeats) + 1;
}

export function getBbSeat(buttonSeat, totalSeats) {
  return ((buttonSeat + 1) % totalSeats) + 1;
}

const RANDOM_NAMES = [
  'Ace', 'Bluff', 'Chip', 'Dealer', 'Flush', 'Grinder', 'Hero', 'Joker',
  'King', 'Loose', 'Maniac', 'Nit', 'Odds', 'Pocket', 'Queen', 'Raiser',
  'Shark', 'Tank', 'Villain', 'Whale',
];
export function randomPlayerName() {
  return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
}

export const TAG_META = {
  fish:   { emoji: '🐟', label: 'Fish',   color: '#1971c2' },
  mouse:  { emoji: '🐭', label: 'Mouse',  color: '#868e96' },
  aggro:  { emoji: '🔥', label: 'Aggro',  color: '#e8590c' },
  reg:    { emoji: '⭐', label: 'Reg',    color: '#7048e8' },
  maniac: { emoji: '💥', label: 'Maniac', color: '#c92a2a' },
  rock:   { emoji: '🪨', label: 'Rock',   color: '#7d5a50' },
};

// ── Money: one source of truth for a hand's net chip result ──────────────────
//
// Stored `result.amount` semantics are unchanged by these helpers:
//   won   → gross net-pot (pot − rake), i.e. every chip pushed to hero
//   lost  → chips the user typed as lost
//   split → hero's share of the pot (gross), blank = got nothing back
// handNet() converts that plus the recorded street actions into hero's real
// signed profit/loss for the hand.

// computeStreetState — replays one street's action list and reports the full
// state: who acts next, current bet, running pot, folded set, per-position
// committed chips, and the amount the next player owes. Shared by the recorder
// UI (PositionSequencer) and the results math (heroInvested).
// initialCommitted: { [pos]: number } — chips posted before any explicit action
// (SB/BB blinds for preflop).
// allInBefore: positions that went all-in on an earlier street — still in the
// hand (eligible for pots) but never asked to act again.
export function computeStreetState(actions, actionOrder, activePositions, initialBet, initialCommitted = {}, allInBefore = []) {
  const foldedSet = new Set();
  const allInSet = new Set(allInBefore);
  const lastActionByPos = {};
  const committed = { ...initialCommitted }; // total chips each pos has put in this street
  let currentBet = initialBet;
  let runningPot = 0;
  const actedSinceLastRaise = new Set();
  let lastAggressorIdx = -1;

  for (const a of actions) {
    const pos = a.pos;
    const idx = actionOrder.indexOf(pos);
    if (idx === -1) continue;

    lastActionByPos[pos] = { action: a.action, amount: a.amount || 0, allIn: !!a.allIn };
    if (a.allIn) allInSet.add(pos);

    if (a.action === 'fold') {
      foldedSet.add(pos);
      actedSinceLastRaise.add(pos);
    } else if (a.action === 'bet' || a.action === 'raise') {
      // a.amount = total raise-to amount (e.g. raise to $18, not raise by $12)
      const total = a.amount || 0;
      const delta = total - (committed[pos] || 0);
      runningPot += Math.max(0, delta);
      committed[pos] = total;
      currentBet = total;
      lastAggressorIdx = idx;
      actedSinceLastRaise.clear();
      actedSinceLastRaise.add(pos);
    } else if (a.action === 'call') {
      // a.amount = full call price (currentBet at time of call); delta = what they add from stack
      const total = a.amount || currentBet;
      const delta = total - (committed[pos] || 0);
      runningPot += Math.max(0, delta);
      committed[pos] = total;
      actedSinceLastRaise.add(pos);
    } else {
      // check
      actedSinceLastRaise.add(pos);
    }
  }

  // Determine which positions are still in
  const activePosSet = new Set(activePositions);
  const stillIn = actionOrder.filter(p => activePosSet.has(p) && !foldedSet.has(p));

  const canAct = stillIn.filter(p => !allInSet.has(p));
  const done = { nextPos: null, currentBet, runningPot, foldedSet, lastActionByPos, toCall: 0, committed, allInSet };
  if (stillIn.length <= 1 || canAct.length === 0) return done;
  // Everyone else is all-in: the last player only acts if they still owe chips.
  if (canAct.length === 1 && (committed[canAct[0]] || 0) >= currentBet) return done;

  // Find nextPos: scan from lastAggressor+1 for someone not folded + not actedSinceLastRaise
  const n = actionOrder.length;
  const startIdx = lastAggressorIdx === -1 ? 0 : (lastAggressorIdx + 1) % n;

  let nextPos = null;
  for (let i = 0; i < n; i++) {
    const idx = (startIdx + i) % n;
    const pos = actionOrder[idx];
    if (!activePosSet.has(pos)) continue;
    if (foldedSet.has(pos)) continue;
    if (allInSet.has(pos)) continue;
    if (!actedSinceLastRaise.has(pos)) {
      nextPos = pos;
      break;
    }
  }

  // toCall = how much the next player needs to add from their stack to call
  const toCall = nextPos ? Math.max(0, currentBet - (committed[nextPos] || 0)) : 0;

  return { nextPos, currentBet, runningPot, foldedSet, lastActionByPos, toCall, committed, allInSet };
}

// Chips a single position put into one street, from that street's action list.
// `seed` = chips already posted before voluntary action (hero blind, preflop).
function positionStreetContribution(actions, pos, seed = 0) {
  const order = [...new Set((actions || []).map(a => a.pos))];
  if (!order.includes(pos)) order.push(pos);
  const { committed } = computeStreetState(
    actions || [], order, order, 0, seed ? { [pos]: seed } : {}
  );
  return committed?.[pos] ?? seed;
}

// The blind hero posted this hand (0 unless hero is in SB/BB).
export function heroBlindPosted(hand, sb = 1, bb = 2) {
  if (hand?.myPosition === 'SB') return sb;
  if (hand?.myPosition === 'BB') return bb;
  return 0;
}

// Total chips hero put into the pot across all streets (voluntary + own blind).
// 0 for quick hands (they store no action lists).
export function heroInvested(hand, sb = 1, bb = 2) {
  if (!hand || hand.quick || !hand.myPosition) return 0;
  const pos = hand.myPosition;
  let total = 0;
  for (const st of ['preflop', 'flop', 'turn', 'river']) {
    const actions = hand[st]?.actions || [];
    const seed = st === 'preflop' ? heroBlindPosted(hand, sb, bb) : 0;
    total += positionStreetContribution(actions, pos, seed);
  }
  return total;
}

// Hero's real signed net for one hand, in chips. opts: { sb, bb }.
export function handNet(hand, opts = {}) {
  const sb = opts.sb ?? 1;
  const bb = opts.bb ?? 2;
  const r = hand?.result || {};
  const amt = Number(r.amount) || 0;

  let net = 0;
  if (hand?.quick) {
    // Quick hands have no action lists — trust the typed amount as the net.
    if (r.outcome === 'won' || r.outcome === 'split') net = amt;
    else if (r.outcome === 'lost') net = -Math.abs(amt);
    else if (r.outcome === 'folded') net = -heroBlindPosted(hand, sb, bb);
  } else {
    switch (r.outcome) {
      case 'won':
        net = amt - heroInvested(hand, sb, bb);
        break;
      case 'lost': {
        const invested = heroInvested(hand, sb, bb);
        net = invested > 0 ? -invested : -Math.abs(amt);
        break;
      }
      case 'split':
        // typed amount = hero's share of the pot (gross), same meaning as won
        net = amt - heroInvested(hand, sb, bb);
        break;
      case 'folded':
        // heroInvested already includes hero's own blind
        net = -heroInvested(hand, sb, bb);
        break;
      default:
        net = 0;
    }
  }
  return net === 0 ? 0 : net; // normalise -0
}

// Sum of handNet over hands, ignoring unfinished drafts. opts: { sb, bb }.
export function sumNet(hands, opts = {}) {
  return (hands || [])
    .filter(h => !h.incomplete)
    .reduce((s, h) => s + handNet(h, opts), 0);
}

// A bet / raise-to amount is valid only if it is a positive number strictly
// above the bet already facing the player (raise-to semantics).
export function isValidBetAmount(amount, currentBet = 0) {
  const n = Number(amount);
  return Number.isFinite(n) && n > 0 && n > (Number(currentBet) || 0);
}

// Next hand number for a session: max existing number + 1 (drafts ignored),
// so deleting a hand never makes the next one reuse a number.
export function nextHandNum(hands) {
  return (hands || [])
    .filter(h => !h.incomplete)
    .reduce((m, h) => Math.max(m, Number(h.handNum) || 0), 0) + 1;
}

// ── Fast sequencer: tap log → action list ─────────────────────────────────────
// taps: chronological [{pos, action, amount}] — only seats that did something
// (hero may also appear with an explicit fold). Seats skipped between taps are
// emitted as folds; with ctx.close, every seat still due to act is folded too.
// Hero is never an implied fold: skipping hero returns error 'hero-skipped'.
export function materializeStreet(taps, ctx) {
  const { actionOrder, activePositions, initialBet = 0, initialCommitted = {}, hero = null, close = false, allInBefore = [] } = ctx;
  const actions = [];
  const nextOf = () =>
    computeStreetState(actions, actionOrder, activePositions, initialBet, initialCommitted, allInBefore).nextPos;

  const foldUntil = (target) => {
    for (;;) {
      const next = nextOf();
      if (next === null) return target === null ? null : 'not-live';
      if (next === target) return null;
      if (next === hero) return 'hero-skipped';
      actions.push({ pos: next, action: 'fold', amount: 0 });
    }
  };

  for (const t of taps || []) {
    const err = foldUntil(t.pos);
    if (err) return { actions, nextPos: nextOf(), error: err };
    actions.push(t.allIn
      ? { pos: t.pos, action: t.action, amount: t.amount || 0, allIn: true }
      : { pos: t.pos, action: t.action, amount: t.amount || 0 });
  }
  if (close) {
    const err = foldUntil(null);
    if (err) return { actions, nextPos: nextOf(), error: err };
  }
  return { actions, nextPos: nextOf(), error: null };
}

// Stored actions → tap log (implied folds dropped, hero's own fold kept).
export function tapsFromActions(actions, hero) {
  return (actions || [])
    .filter(a => a.action !== 'fold' || a.pos === hero)
    .map(a => (a.allIn
      ? { pos: a.pos, action: a.action, amount: a.amount || 0, allIn: true }
      : { pos: a.pos, action: a.action, amount: a.amount || 0 }));
}

function streetStateAfter(taps, ctx) {
  const { actions } = materializeStreet(taps, { ...ctx, close: false });
  return computeStreetState(actions, ctx.actionOrder, ctx.activePositions, ctx.initialBet || 0, ctx.initialCommitted || {}, ctx.allInBefore || []);
}

// Default action for tapping `pos`: call if it owes chips, else check.
export function facingTap(taps, pos, ctx) {
  const { currentBet, committed } = streetStateAfter(taps, ctx);
  return currentBet - (committed[pos] || 0) > 0
    ? { pos, action: 'call', amount: currentBet }
    : { pos, action: 'check', amount: 0 };
}

// A bet / raise-to for `pos` after `tapsBefore`; null if the size is invalid.
export function betTap(tapsBefore, pos, amount, ctx) {
  const { currentBet } = streetStateAfter(tapsBefore, ctx);
  if (!isValidBetAmount(amount, currentBet)) return null;
  return { pos, action: currentBet > 0 ? 'raise' : 'bet', amount: Number(amount) };
}

// All-in for `amount` (raise-to / total committed this street) by `pos` after
// `tapsBefore`. Above the current bet → bet/raise; at or below → call for less.
export function allInTap(tapsBefore, pos, amount, ctx) {
  const n = Number(amount);
  const { currentBet, committed } = streetStateAfter(tapsBefore, ctx);
  if (!Number.isFinite(n) || n <= (committed[pos] || 0)) return null;
  if (n > currentBet) return { pos, action: currentBet > 0 ? 'raise' : 'bet', amount: n, allIn: true };
  return { pos, action: 'call', amount: n, allIn: true };
}

// ── Hero changed seat after recording (#6) ─────────────────────────────────────
// streets: { preflop, flop, turn, river } action arrays. Hero's taps move from
// oldPos to newPos, replacing whatever newPos had; oldPos becomes "never acted"
// (an implied fold). Each street keeps its longest valid prefix and is closed
// when possible; if hero now owes an action the street is left open for re-entry.
export function relocateHero(streets, oldPos, newPos, opts) {
  if (!oldPos || !newPos || oldPos === newPos) return streets;
  return rebuildStreets(streets, oldPos, newPos, (actions) => tapsFromActions(actions, oldPos)
    .filter(t => t.pos !== newPos)
    .map(t => (t.pos === oldPos ? { ...t, pos: newPos } : t)), opts);
}

// After an earlier street changed: each later street keeps its longest valid
// prefix given who is still in (e.g. a player now folded loses their flop bet).
export function revalidateStreets(streets, hero, opts) {
  return rebuildStreets(streets, hero, hero, (actions) => tapsFromActions(actions, hero), opts);
}

// Shared core: replay every street's taps against the live seats left by the
// previous streets. A street that was closed (its stored list ends with an
// implied fold, or nobody is left to act) stays closed when it still can be;
// a street still being entered stays open.
function rebuildStreets(streets, storedHero, hero, toTaps, { totalSeats, sb = 1, bb = 2 }) {
  const table = TABLE_POSITIONS[totalSeats] || TABLE_POSITIONS[9];
  let live = table;
  let allIn = [];
  const out = {};
  for (const st of ['preflop', 'flop', 'turn', 'river']) {
    if (!(st in streets)) continue;
    const actions = streets[st] || [];
    if (actions.length === 0 || live.length <= 1) { out[st] = []; continue; }
    const isPre = st === 'preflop';
    const orders = isPre ? PREFLOP_ACTION_ORDER : POSTFLOP_ACTION_ORDER;
    const ctx = {
      actionOrder: (orders[totalSeats] || orders[9]).filter(p => live.includes(p)),
      activePositions: live,
      initialBet: isPre ? bb : 0,
      initialCommitted: isPre ? { SB: sb, BB: bb } : {},
      hero,
      allInBefore: allIn,
    };
    const taps = toTaps(actions);
    let valid = [];
    for (let i = 1; i <= taps.length; i++) {
      if (materializeStreet(taps.slice(0, i), ctx).error) break;
      valid = taps.slice(0, i);
    }
    const last = actions[actions.length - 1];
    const wasClosed = last.action === 'fold' && last.pos !== storedHero;
    const open = materializeStreet(valid, ctx);
    const closed = wasClosed ? materializeStreet(valid, { ...ctx, close: true }) : null;
    const result = closed && !closed.error ? closed : open;
    out[st] = result.actions;
    const state = computeStreetState(result.actions, ctx.actionOrder, live, ctx.initialBet, ctx.initialCommitted, allIn);
    live = live.filter(p => !state.foldedSet.has(p));
    allIn = [...state.allInSet];
  }
  return out;
}

// Seats that "Done" would fold right now, in order. Empty when the round is
// already closed or hero still has to act.
export function pendingFolds(taps, ctx) {
  const open = materializeStreet(taps, ctx);
  if (open.error || open.nextPos === null) return [];
  const closed = materializeStreet(taps, { ...ctx, close: true });
  if (closed.error) return [];
  return closed.actions.slice(open.actions.length).filter(a => a.action === 'fold').map(a => a.pos);
}

// Distinct non-empty values of `key`, most recent session first (case/space-insensitive).
export function recentValues(sessions, key, filter = null) {
  const norm = (v) => v.toLowerCase().replace(/\s+/g, ' ');
  const seen = new Set();
  const out = [];
  const sorted = [...(sessions || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  for (const s of sorted) {
    if (filter && !filter(s)) continue;
    const v = (s[key] || '').trim();
    if (!v || seen.has(norm(v))) continue;
    seen.add(norm(v));
    out.push(v);
  }
  return out;
}
