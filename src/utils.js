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

export function parseBB(gameStr) {
  // "NL $1/$2" → 2,  "NL P50/P100" → 100,  "PLO ₱25/₱50" → 50
  const m = gameStr?.match(/[₱$P£€]?([\d.]+)\s*\/\s*[₱$P£€]?([\d.]+)/);
  return m ? parseFloat(m[2]) : 2;
}

export function parseSB(gameStr) {
  // "NL $1/$2" → 1,  "NL $2/$5" → 2,  "PLO ₱25/₱50" → 25
  const m = gameStr?.match(/[₱$P£€]?([\d.]+)\s*\/\s*[₱$P£€]?([\d.]+)/);
  return m ? parseFloat(m[1]) : 1;
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
export function computeStreetState(actions, actionOrder, activePositions, initialBet, initialCommitted = {}) {
  const foldedSet = new Set();
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

    lastActionByPos[pos] = { action: a.action, amount: a.amount || 0 };

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

  if (stillIn.length <= 1) {
    return { nextPos: null, currentBet, runningPot, foldedSet, lastActionByPos, toCall: 0, committed };
  }

  // Find nextPos: scan from lastAggressor+1 for someone not folded + not actedSinceLastRaise
  const n = actionOrder.length;
  const startIdx = lastAggressorIdx === -1 ? 0 : (lastAggressorIdx + 1) % n;

  let nextPos = null;
  for (let i = 0; i < n; i++) {
    const idx = (startIdx + i) % n;
    const pos = actionOrder[idx];
    if (!activePosSet.has(pos)) continue;
    if (foldedSet.has(pos)) continue;
    if (!actedSinceLastRaise.has(pos)) {
      nextPos = pos;
      break;
    }
  }

  // toCall = how much the next player needs to add from their stack to call
  const toCall = nextPos ? Math.max(0, currentBet - (committed[nextPos] || 0)) : 0;

  return { nextPos, currentBet, runningPot, foldedSet, lastActionByPos, toCall, committed };
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
        net = -heroBlindPosted(hand, sb, bb);
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
