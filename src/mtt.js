// MTT (tournament) sessions: everything kind-specific lives here.
// Cash sessions have no `kind` (or kind 'cash') and must behave exactly as before.
import { parseSB, parseBB, currencySymbol } from './utils.js';

export const ENTRY_TYPES = [
  { type: 'reentry', label: 'Re-entry' },
  { type: 'rebuy', label: 'Rebuy' },
  { type: 'addon', label: 'Add-on' },
];
const ENTRY_WORD = { buyin: 'buy-in', reentry: 're-entry', rebuy: 'rebuy', addon: 'add-on' };

export function isMtt(session) {
  return session?.kind === 'mtt';
}

export function currentLevel(session) {
  const levels = isMtt(session) ? session.levels || [] : [];
  const last = levels[levels.length - 1];
  if (!last) return null;
  return { level: last.level, sb: Number(last.sb) || 0, bb: Number(last.bb) || 0, ante: Number(last.ante) || 0 };
}

export function totalInvested(session) {
  return (session?.entries || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
}

export function entrySummary(session) {
  const counts = {};
  for (const e of session?.entries || []) counts[e.type] = (counts[e.type] || 0) + 1;
  return ['buyin', 'reentry', 'rebuy', 'addon']
    .filter(t => counts[t])
    .map(t => `${counts[t]} ${ENTRY_WORD[t]}${counts[t] > 1 ? 's' : ''}`)
    .join(' + ');
}

export function bbCount(chips, bb) {
  const b = Number(bb);
  if (!(b > 0)) return null;
  return Math.round((Number(chips) || 0) / b * 10) / 10;
}

export function nextLevelDraft(session) {
  const cur = currentLevel(session) || { sb: 0, bb: 0, ante: 0 };
  return { sb: cur.sb, bb: cur.bb, ante: cur.ante };
}

export function handBlinds(session, hand) {
  if (isMtt(session)) {
    const b = hand?.blinds || currentLevel(session) || { sb: 0, bb: 0, ante: 0 };
    return { sb: Number(b.sb) || 0, bb: Number(b.bb) || 0, ante: Number(b.ante) || 0 };
  }
  return { sb: parseSB(session?.game), bb: parseBB(session?.game), ante: 0 };
}

// Prefill for a new hand: latest hand's blinds → old session levels → blank.
export function lastHandBlinds(session, hands) {
  const withBlinds = (hands || []).filter(h => h?.blinds);
  const key = (h) => (h.handNum != null ? Number(h.handNum) : -Infinity);
  let last = null;
  for (const h of withBlinds) {
    if (!last) { last = h; continue; }
    const a = key(h), b = key(last);
    if (a > b || (a === b && String(h.createdAt || '') > String(last.createdAt || ''))) last = h;
  }
  if (last) return { sb: last.blinds.sb, bb: last.blinds.bb, ante: last.blinds.ante };
  const cur = currentLevel(session);
  if (cur) return { sb: cur.sb, bb: cur.bb, ante: cur.ante };
  return { sb: '', bb: '', ante: '' };
}

export function chipSym(session) {
  return isMtt(session) ? '' : currencySymbol(session?.currency);
}

export function levelLabel(b) {
  if (!b) return '';
  const base = `${b.level ? `Lv${b.level} ` : ''}${Number(b.sb).toLocaleString()}/${Number(b.bb).toLocaleString()}`;
  return Number(b.ante) > 0 ? `${base} (${Number(b.ante).toLocaleString()})` : base;
}

// Re-derive pots/actions from edited blinds only at a commit point (blur / step advance / save),
// never per keystroke: needs entered actions, a real BB, and numbers that differ from last derivation.
export function shouldRederive(prevBlinds, nextBlinds, hasActions) {
  if (!hasActions || !(Number(nextBlinds?.bb) > 0)) return false;
  const n = (b, k) => Number(b?.[k]) || 0;
  return ['sb', 'bb', 'ante'].some(k => n(prevBlinds, k) !== n(nextBlinds, k));
}

// ── Preflop stacks ("後手"): hand.stacks = { [pos]: chips } ──
// Rows to show: hero first, then positions with a preflop action, then already-typed orphans.
export function stackRows(hand) {
  const rows = [];
  const add = (p) => { if (p && !rows.includes(p)) rows.push(p); };
  add(hand?.myPosition);
  (hand?.preflop?.actions || []).forEach(a => add(a.pos));
  Object.keys(hand?.stacks || {}).forEach(add);
  return rows;
}

export function cleanStacks(stacks) {
  const out = {};
  Object.entries(stacks || {}).forEach(([p, v]) => {
    const n = Number(v);
    if (n > 0) out[p] = n;
  });
  return out;
}

export function formatStacks(hand, bb) {
  const parts = Object.entries(cleanStacks(hand?.stacks)).map(([p, n]) => {
    const c = bbCount(n, bb);
    return `${p} ${n.toLocaleString()}${c != null ? ` (${c} BB)` : ''}`;
  });
  return parts.join(' · ');
}
