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
  if (totalSeats === 6) {
    // offsets: 0=BTN,1=SB,2=BB,3=EP,4=HJ,5=CO
    const map = { 3: 'EP', 4: 'HJ', 5: 'CO' };
    return map[offset] || 'MP';
  }
  if (totalSeats === 8) {
    // 0=BTN,1=SB,2=BB,3=EP,4=EP,5=MP,6=HJ,7=CO
    const map = { 3: 'EP', 4: 'EP', 5: 'MP', 6: 'HJ', 7: 'CO' };
    return map[offset] || 'MP';
  }
  if (totalSeats === 9) {
    // 0=BTN,1=SB,2=BB,3=EP,4=EP,5=MP,6=MP,7=HJ,8=CO
    const map = { 3: 'EP', 4: 'EP', 5: 'MP', 6: 'MP', 7: 'HJ', 8: 'CO' };
    return map[offset] || 'MP';
  }
  // fallback
  const positions = ['BTN', 'SB', 'BB', 'EP', 'MP', 'HJ', 'CO'];
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
  8: ['SB', 'BB', 'UTG', 'UTG+1', 'HJ', 'CO', 'BTN'],
  9: ['SB', 'BB', 'UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN'],
};

export const PREFLOP_ACTION_ORDER = {
  6: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  8: ['UTG', 'UTG+1', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  9: ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
};

export const POSTFLOP_ACTION_ORDER = {
  6: ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'],
  8: ['SB', 'BB', 'UTG', 'UTG+1', 'HJ', 'CO', 'BTN'],
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
