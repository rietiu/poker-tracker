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
  return positionAmong(Array.from({ length: totalSeats }, (_, i) => i + 1), mySeat, buttonSeat);
}

// Inverse of calcPosition: which seat holds the dealer button when I sit in
// `mySeat` and play `position`. null when it can't be worked out.
export function buttonSeatFor(totalSeats, mySeat, position) {
  if (!totalSeats || !mySeat || !position) return null;
  for (let btn = 1; btn <= totalSeats; btn++) {
    if (calcPosition(totalSeats, mySeat, btn) === position) return btn;
  }
  return null;
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

// ── Positions for 2–9 players ─────────────────────────────────────────────────
// Non-blind, non-button positions from earliest to latest, by players dealt in.
const MIDDLE_POSITIONS = {
  2: [], 3: [], 4: ['CO'], 5: ['UTG', 'CO'], 6: ['UTG', 'HJ', 'CO'],
  7: ['UTG', 'LJ', 'HJ', 'CO'], 8: ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO'],
  9: ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO'],
};
const byCount = (fn) => Object.fromEntries(Object.keys(MIDDLE_POSITIONS).map(n => [n, fn(Number(n), MIDDLE_POSITIONS[n])]));

// Heads-up: the button posts the small blind (named SB), acts first pre-flop, last after.
export const TABLE_POSITIONS = byCount((n, mid) => (n === 2 ? ['SB', 'BB'] : ['SB', 'BB', ...mid, 'BTN']));
export const PREFLOP_ACTION_ORDER = byCount((n, mid) => (n === 2 ? ['SB', 'BB'] : [...mid, 'BTN', 'SB', 'BB']));
export const POSTFLOP_ACTION_ORDER = byCount((n, mid) => (n === 2 ? ['BB', 'SB'] : ['SB', 'BB', ...mid, 'BTN']));
// Clockwise from the button: offset 0 = button.
const RING_FROM_BUTTON = byCount((n, mid) => (n === 2 ? ['SB', 'BB'] : ['BTN', 'SB', 'BB', ...mid]));

// Every distinct position across table sizes, ordered late -> early then blinds.
// History's position filter uses this so UTG / LJ / UTG+1 hands are filterable
// (the old hard-coded list used EP/MP names that no recorded hand ever has).
export const HISTORY_FILTER_POSITIONS = ['BTN', 'CO', 'HJ', 'LJ', 'MP', 'UTG+1', 'UTG', 'SB', 'BB'];

// ── Seats ─────────────────────────────────────────────────────────────────────
// Position of `mySeat` when the button is on `buttonSeat`, counting only the
// seats dealt in (away / empty seats are skipped). '' if it can't be worked out.
export function positionAmong(activeSeats, mySeat, buttonSeat) {
  const ring = [...new Set(activeSeats || [])].sort((a, b) => a - b);
  const n = ring.length;
  const me = ring.indexOf(mySeat), btn = ring.indexOf(buttonSeat);
  if (n < 2 || n > 9 || me === -1 || btn === -1) return '';
  return RING_FROM_BUTTON[n][(me - btn + n) % n];
}

export function buttonSeatAmong(activeSeats, mySeat, position) {
  if (!position) return null;
  for (const btn of activeSeats || []) {
    if (positionAmong(activeSeats, mySeat, btn) === position) return btn;
  }
  return null;
}

// Seat statuses: 'active' (someone sitting), 'away' (bathroom, meal…), 'empty'.
// Older sessions used 'left' for a seat nobody is in.
export const SEAT_OUT = ['away', 'empty', 'left'];
export function activeSeatNums(session) {
  const total = session?.totalSeats || 9;
  const seats = session?.seats || [];
  const out = [];
  for (let n = 1; n <= total; n++) {
    const s = seats.find(x => x.seatNum === n);
    if (n === session?.mySeat || !SEAT_OUT.includes(s?.status)) out.push(n);
  }
  return out;
}

// Who sat where, and in which position, for one hand.
export function seatingAtHand(seats, activeSeats, mySeat, buttonSeat) {
  return [...activeSeats].sort((a, b) => a - b).map(n => {
    const s = (seats || []).find(x => x.seatNum === n) || {};
    return {
      seat: n,
      position: positionAmong(activeSeats, n, buttonSeat),
      code: n === mySeat ? 'ME' : (s.code || ''),
      name: n === mySeat ? 'Me' : (s.name || ''),
    };
  });
}

// Old sessions: make sure every seat exists, occupied seats have a code and
// the old 'left' status reads as 'empty'.
export function ensureSeatCodes(session) {
  const total = session.totalSeats || 9;
  const seats = Array.from({ length: total }, (_, i) => {
    const n = i + 1;
    const s = (session.seats || []).find(x => x.seatNum === n) || {};
    return {
      name: '', tags: [], estimatedStack: '', ...s, seatNum: n,
      status: s.status === 'left' || s.status === 'empty' ? 'empty' : (s.status || 'active'),
      code: s.code || '',
    };
  });
  for (const s of seats) {
    if (s.seatNum !== session.mySeat && s.status !== 'empty' && !s.code) {
      s.code = nextPlayerCode([...seats.map(x => x.code), ...(session.seatLog || []).map(e => e.code)].filter(Boolean));
    }
  }
  return { ...session, seats, seatLog: session.seatLog || [] };
}

// One seat change at the table. Returns a new session (seats + seatLog).
// A move onto a taken seat means its occupant left: they are logged as 'left'
// first. Throws if a player move targets my seat.
export function applySeatEvent(session, event, at = new Date().toISOString()) {
  const next = ensureSeatCodes(session);
  const seats = next.seats.map(x => ({ ...x }));
  const get = (n) => seats.find(x => x.seatNum === n);
  const cleared = { code: '', name: '', tags: [], estimatedStack: '', playerId: '', notes: '', looks: [], status: 'empty' };
  const who = (x) => ({ code: x.code || '', name: x.name || '' });
  let mySeat = next.mySeat;
  let log;
  const pre = [];
  const vacate = (n) => {
    const s = get(n);
    if (s.status === 'empty') return;
    pre.push({ at, type: 'left', seat: n, ...who(s) });
    Object.assign(s, cleared);
  };
  switch (event.type) {
    case 'away':
    case 'back': {
      const s = get(event.seat);
      s.status = event.type === 'away' ? 'away' : 'active';
      log = { type: event.type, seat: event.seat, ...who(s) };
      break;
    }
    case 'left': {
      const s = get(event.seat);
      log = { type: 'left', seat: event.seat, ...who(s) };
      Object.assign(s, cleared);
      break;
    }
    case 'seated': {
      const s = get(event.seat);
      // never reuse a code that anyone used earlier in this session
      const used = [...seats.map(x => x.code), ...next.seatLog.map(e => e.code)].filter(Boolean);
      Object.assign(s, { status: 'active', name: '', tags: [], estimatedStack: '', playerId: '', notes: '', looks: [], code: nextPlayerCode(used) });
      log = { type: 'seated', seat: event.seat, code: s.code };
      break;
    }
    case 'move': {
      const from = get(event.from), to = get(event.to);
      if (event.to === mySeat || event.to === event.from) throw new Error(`Can't move to seat ${event.to}`);
      vacate(event.to);
      Object.assign(to, { code: from.code, name: from.name, tags: from.tags, estimatedStack: from.estimatedStack, playerId: from.playerId || '', notes: from.notes || '', looks: from.looks || [], status: 'active' });
      log = { type: 'move', from: event.from, to: event.to, ...who(from) };
      Object.assign(from, cleared);
      break;
    }
    case 'heroMove': {
      const to = get(event.to);
      if (event.to === mySeat) throw new Error(`Already in seat ${event.to}`);
      vacate(event.to);
      Object.assign(to, { ...cleared, status: 'active' });
      Object.assign(get(mySeat), cleared);
      log = { type: 'heroMove', from: mySeat, to: event.to };
      mySeat = event.to;
      break;
    }
    default:
      throw new Error(`Unknown seat event ${event.type}`);
  }
  return { ...next, mySeat, seats, seatLog: [...next.seatLog, ...pre, { at, ...log }] };
}

// Saved players matching what I see: nickname or notes contain `query`
// (case-insensitive) AND they have every picked appearance key in `looks`.
// Name matches first, then most recently seen. Nothing given → none.
// Familiarity (面熟/面生) describes my memory, not the person, so it never
// filters.
export function matchPlayers(players, query, { looks = [], limit = 5 } = {}) {
  const q = (query || '').trim().toLowerCase();
  const need = looks.filter(k => LOOK_META[k]?.group !== 'familiar');
  if (!q && need.length === 0) return [];
  const score = (p) => {
    if (!need.every(k => (p.looks || []).includes(k))) return 2;
    if (!q) return 0;
    return (p.name || '').toLowerCase().includes(q) ? 0 : (p.notes || '').toLowerCase().includes(q) ? 1 : 2;
  };
  return players
    .filter(p => score(p) < 2)
    .sort((a, b) => score(a) - score(b) || (b.lastSeen || b.createdAt || '').localeCompare(a.lastSeen || a.createdAt || ''))
    .slice(0, limit);
}

export function describeSeatEvent(e) {
  const label = e.name ? `${e.name} (${e.code})` : e.code;
  switch (e.type) {
    case 'move': return `${label} moved seat ${e.from} → ${e.to}`;
    case 'heroMove': return `I moved seat ${e.from} → ${e.to}`;
    case 'away': return `${label} (seat ${e.seat}) is away`;
    case 'back': return `${label} is back in seat ${e.seat}`;
    case 'left': return `${label} left seat ${e.seat} — empty`;
    case 'seated': return `New player ${e.code} sat in seat ${e.seat}`;
    default: return '';
  }
}

// ── Wall-clock times (local) ─────────────────────────────────────────────────
const pad2 = (n) => String(n).padStart(2, '0');
// "HH:MM" of an ISO time; '' when missing or invalid.
export function clockOf(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function atClock(day, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
}
// "Nov 15 21:05" for lists.
export function formatWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${clockOf(iso)}`;
}
// Session start typed as "HH:MM": today, unless that is still in the future
// (opened after midnight for a session that began last night) → yesterday.
export function sessionStartFrom(hhmm, now = new Date()) {
  if (!/^\d{1,2}:\d{2}$/.test(hhmm || '')) return new Date(now).toISOString();
  const d = atClock(now, hhmm);
  if (d.getTime() > new Date(now).getTime() + 5 * 60000) d.setDate(d.getDate() - 1);
  return d.toISOString();
}
// Hand time typed as "HH:MM" → ISO on the session's day; a time well before
// the session started means the game went past midnight → next day.
// Blank → null (time unknown).
export function handTimeFrom(hhmm, sessionStartIso) {
  if (!/^\d{1,2}:\d{2}$/.test(hhmm || '')) return null;
  const start = new Date(sessionStartIso || Date.now());
  const d = atClock(start, hhmm);
  if (d.getTime() < start.getTime() - 60 * 60000) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

// Default player codes: A, B, … Z, AA, AB, …
export function nextPlayerCode(used) {
  const taken = new Set(used || []);
  for (let i = 0; ; i++) {
    let code = '', k = i;
    do { code = String.fromCharCode(65 + (k % 26)) + code; k = Math.floor(k / 26) - 1; } while (k >= 0);
    if (!taken.has(code)) return code;
  }
}

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
      rakeRoundUnit: s.rakeRoundUnit || 0,
      rakeRoundMode: s.rakeRoundMode || 'nearest',
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
    if (Number(p.rakeRoundUnit) > 0) {
      const unit = `${sym}${Number(p.rakeRoundUnit).toLocaleString('en-US')}`;
      parts.push(p.rakeRoundMode === 'down' ? `per ${unit} down` : `nearest ${unit}`);
    }
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

// Player read tags. Tags sharing a `group` are opposites (strong/weak,
// wide/narrow) — picking one drops the other. `legacy` tags are the old
// archetype labels: still rendered on players that have them, but no longer
// offered in the selector.
export const TAG_META = {
  defStrong:   { emoji: '🛡️', label: '防守強', short: '防強', group: 'def',   color: '#1864ab' },
  defWeak:     { emoji: '🛡️', label: '防守弱', short: '防弱', group: 'def',   color: '#5c8fc2' },
  atkStrong:   { emoji: '⚔️', label: '進攻強', short: '攻強', group: 'atk',   color: '#c92a2a' },
  atkWeak:     { emoji: '⚔️', label: '進攻弱', short: '攻弱', group: 'atk',   color: '#c87070' },
  rangeWide:   { emoji: '↔️', label: '範圍寬', short: '範寬', group: 'range', color: '#2b8a3e' },
  rangeNarrow: { emoji: '↔️', label: '範圍窄', short: '範窄', group: 'range', color: '#6a9a72' },
  sticky:      { emoji: '🧲', label: '黏池',   short: '黏池', color: '#7048e8' },
  likes3b:     { emoji: '🔁', label: '喜歡3B', short: '愛3B', color: '#d6336c' },
  raiseOnly:   { emoji: '⬆️', label: '入池必Raise', short: '必R', color: '#e8590c' },
  ep3b:        { emoji: '🎯', label: '喜歡前位3B', short: '前3B', color: '#a61e4d' },
  trapper:     { emoji: '🪤', label: '蹲蹲俠', short: '蹲', color: '#5f3dc4' },
  reverse:     { emoji: '🎭', label: '有牌check沒牌打', short: '反打', color: '#0b7285' },
  rarelyPlays: { emoji: '🐢', label: '很少入池', short: '少入池', color: '#495057' },
  fish:   { emoji: '🐟', label: 'Fish',   short: 'Fish',   legacy: true, color: '#1971c2' },
  mouse:  { emoji: '🐭', label: 'Mouse',  short: 'Mouse',  legacy: true, color: '#868e96' },
  aggro:  { emoji: '🔥', label: 'Aggro',  short: 'Aggro',  legacy: true, color: '#e8590c' },
  reg:    { emoji: '⭐', label: 'Reg',    short: 'Reg',    legacy: true, color: '#7048e8' },
  maniac: { emoji: '💥', label: 'Maniac', short: 'Maniac', legacy: true, color: '#c92a2a' },
  rock:   { emoji: '🪨', label: 'Rock',   short: 'Rock',   legacy: true, color: '#7d5a50' },
};

// Toggle `key` in a selection; picking a grouped key replaces the one already
// picked from that group (single choice per group).
function toggleKey(meta, selected, key) {
  if (selected.includes(key)) return selected.filter(t => t !== key);
  const group = meta[key]?.group;
  const kept = group ? selected.filter(t => meta[t]?.group !== group) : selected;
  return [...kept, key];
}
export const toggleTag = (selected, tag) => toggleKey(TAG_META, selected, tag);

// Appearance — how to recognise someone next time. Keys sharing a `group`
// are single choice (one nationality, one age band…); `wear` items combine.
export const LOOK_GROUPS = [
  { id: 'nation', label: '國籍' },
  { id: 'age', label: '年紀' },
  { id: 'gender', label: '性別' },
  { id: 'wear', label: '穿戴', multi: true },
  { id: 'traits', label: '特徵', multi: true },
  { id: 'familiar', label: '面熟' },
  { id: 'talk', label: '講話' },
];
const MULTI_LOOK_GROUPS = new Set(LOOK_GROUPS.filter(g => g.multi).map(g => g.id));
export const LOOK_META = {
  ph: { label: '菲律賓', group: 'nation' },
  cn: { label: '華人', group: 'nation' },
  kr: { label: '韓國', group: 'nation' },
  jp: { label: '日本', group: 'nation' },
  vn: { label: '越南', group: 'nation' },
  in: { label: '印度', group: 'nation' },
  west: { label: '西方人', group: 'nation' },
  otherNation: { label: '其他', group: 'nation' },
  a20: { label: '20幾', group: 'age' },
  a30: { label: '30幾', group: 'age' },
  a40: { label: '40幾', group: 'age' },
  a50: { label: '50幾', group: 'age' },
  a60: { label: '60+', group: 'age' },
  male: { label: '男', group: 'gender' },
  female: { label: '女', group: 'gender' },
  glasses: { label: '眼鏡', group: 'wear' },
  cap: { label: '帽', group: 'wear' },
  jacket: { label: '外套', group: 'wear' },
  mask: { label: '口罩', group: 'wear' },
  headphones: { label: '耳機', group: 'wear' },
  rolex: { label: 'Rolex', group: 'traits' },
  tattoo: { label: '紋身', group: 'traits' },
  phone: { label: '成日睇電話', group: 'traits' },
  familiar: { label: '面熟', group: 'familiar' },
  stranger: { label: '面生', group: 'familiar' },
  chatty: { label: '愛講話', group: 'talk' },
  quiet: { label: '安靜', group: 'talk' },
};
export const toggleLook = (selected, key) =>
  MULTI_LOOK_GROUPS.has(LOOK_META[key]?.group)
    ? (selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key])
    : toggleKey(LOOK_META, selected, key);
export const lookKeysIn = (groupId) => Object.keys(LOOK_META).filter(k => LOOK_META[k].group === groupId);
// "韓國 · 40幾 · 眼鏡" in LOOK_META order.
export const describeLooks = (looks = []) =>
  Object.keys(LOOK_META).filter(k => looks.includes(k)).map(k => LOOK_META[k].label).join(' · ');

// Tags the selector offers: every current tag, plus any legacy tag already
// selected (so it can still be removed).
export function selectableTags(selected = []) {
  return Object.keys(TAG_META).filter(t => !TAG_META[t].legacy || selected.includes(t));
}

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

// True when tapping `pos` would be a call that ends the betting round (no seat
// left due to act). Such a tap must not default to call — the recorder asks.
export function closingCall(taps, pos, ctx) {
  const t = facingTap(taps, pos, ctx);
  if (t.action !== 'call') return false;
  const m = materializeStreet([...taps, t], { ...ctx, close: false });
  return !m.error && m.nextPos === null;
}

// ── C-bet guess (flop / turn suggestion card) ─────────────────────────────────
function lastAggressor(actions) {
  for (let i = (actions || []).length - 1; i >= 0; i--) {
    const a = actions[i];
    if (a.action === 'bet' || a.action === 'raise') return a.pos;
  }
  return null;
}

// Who is expected to bet first on `street` ('flop' | 'turn') and the final
// pre-flop bet (what each caller put in). Turn: last flop bettor, else the
// pre-flop aggressor (delayed c-bet). null when nobody raised pre-flop.
export function cbetHint({ preflop = [], flop = [] }, street) {
  const pfAggressor = lastAggressor(preflop);
  if (!pfAggressor) return null;
  const pfAmount = Math.max(0, ...preflop.filter(a => a.action !== 'fold').map(a => a.amount || 0));
  const aggressor = street === 'turn' ? (lastAggressor(flop) || pfAggressor) : pfAggressor;
  return { aggressor, pfAmount };
}

// Suggested sizes: the pre-flop amount, 2/3 pot 3-way or 3/4 pot 4+ way, full pot.
export function cbetSizes(pfAmount, pot, players, bb) {
  const toBB = (x) => (bb > 0 ? Math.max(bb, Math.round(x / bb) * bb) : Math.round(x));
  const sizes = [{ label: 'PF', amt: pfAmount }];
  if (players === 3) sizes.push({ label: '2/3', amt: toBB(pot * 2 / 3) });
  if (players >= 4) sizes.push({ label: '3/4', amt: toBB(pot * 3 / 4) });
  sizes.push({ label: 'Pot', amt: pot });
  return sizes;
}

// Check taps for every seat due before `target` (untapped seats would fold).
// null if `target` is never due to act.
export function checksUntil(taps, target, ctx) {
  const out = [...taps];
  for (;;) {
    const m = materializeStreet(out, { ...ctx, close: false });
    if (m.error || m.nextPos === null) return null;
    if (m.nextPos === target) return out.slice(taps.length);
    out.push({ pos: m.nextPos, action: 'check', amount: 0 });
  }
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
