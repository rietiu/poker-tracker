# Poker Tracker Logic Fixes — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. Execute inline; no subagents.

**Goal:** Fix 7 logical errors (A–G) in the poker-tracker PWA so session/hand/lifetime results are computed correctly and position handling is consistent.

**Architecture:** Introduce one shared money helper `handNet(hand)` in `src/utils.js` as the single source of truth for a hand's net chip result. Move street-state pot math (`computeStreetState`) from `PositionSequencer.jsx` into `src/utils.js` so both the recorder UI and `handNet` use the same engine. Canonicalise position lists to `TABLE_POSITIONS`. Filter out `incomplete` drafts everywhere hands are counted or summed. Add Vitest for the pure functions.

**Tech Stack:** React 19, Vite 7, `idb` (IndexedDB), react-router 7. Add `vitest` (dev).

## Global Constraints

- No IndexedDB schema/version bump. `handNet` must work on **existing stored hands** with no data migration.
- `result.amount` keeps its current stored meaning: for `won` it is the gross net-pot (pot − rake); for `lost` it is the chips lost; for `split`/quick it is whatever the user typed. `handNet` interprets it; storage is untouched.
- Currency-agnostic: all math in chips (numbers), no locale parsing.
- Keep the 4 currency symbols map (`USD $`, `PHP ₱`, `EUR €`, `GBP £`).
- Match existing code style: 2-space indent, single quotes, keep semicolons, named exports from `utils.js`.

---

## File Structure

| File | Responsibility after this plan |
| ---- | ------------------------------ |
| `src/utils.js` | Adds `computeStreetState`, `heroInvested(hand)`, `heroBlindPosted(hand, sb, bb)`, `handNet(hand)`, `sumNet(hands)`; `TABLE_POSITIONS` stays the canonical position source; adds `HISTORY_FILTER_POSITIONS`. `calcPosition` naming fixed. |
| `src/components/PositionSequencer.jsx` | Imports `computeStreetState` from utils instead of defining it. Receives and uses a real `sb` prop. |
| `src/screens/HandRecorder.jsx` | `preflopStartPot = sb + bb`. Passes `sb={sb}` to every `PositionSequencer`. Result step shows computed net under the amount input. |
| `src/screens/SessionView.jsx` | `netResult` uses `sumNet(completedHands)`. |
| `src/screens/History.jsx` | Filters `!incomplete`; `totalNet` uses `sumNet`; position pills from `HISTORY_FILTER_POSITIONS`. |
| `src/screens/Home.jsx` | Per-session count and net exclude `incomplete`; net uses `sumNet`. |
| `src/screens/QuickHandEntry.jsx` | `handNum` excludes `incomplete`; position grid from `TABLE_POSITIONS[session.totalSeats]`. |
| `src/screens/HandDetail.jsx` | Result summary shows `handNet` alongside the raw amount. |
| `test/utils.test.js` | Vitest unit tests for the helpers. |
| `package.json` | `vitest` dev dep + `"test": "vitest run"`. |
| `src/components/{ActionSequencer,PotBuilder,StreetEntry,CardPicker}.jsx` | **Deleted** — dead code (not imported anywhere), and the only callers of the buggy `calcPosition`/`getSbSeat`/`getBbSeat`. |

---

## Bug → Task map

- **A** win profit overcount → Task 3 (`handNet`), Tasks 5–8 (wire `sumNet`)
- **B** split handling → Task 3 (`handNet` split branch), Task 4 (recorder net preview)
- **C** incomplete drafts counted → Tasks 6, 7, 9
- **D** position vocab mismatch → Task 2 (canonical lists), Task 9 (quick), Task 7 (history), Task 10 (delete dead code + fix `calcPosition`)
- **E** `1.5*bb` blind assumption → Task 4
- **F** folded hands always $0 → Task 3 (`handNet` folded branch = `−heroBlindPosted`)
- **G** 4 copies of the reducer → Task 3 (`sumNet`), Tasks 5–8

---

### Task 1: Add Vitest

**Files:** Modify `package.json`; Create `test/utils.test.js`

- [ ] **Step 1:** `npm i -D vitest@^3`
- [ ] **Step 2:** In `package.json` `scripts` add `"test": "vitest run"` and `"test:watch": "vitest"`.
- [ ] **Step 3:** Create `test/utils.test.js`:

```js
import { describe, it, expect } from 'vitest';
describe('placeholder', () => { it('runs', () => { expect(1).toBe(1); }); });
```

- [ ] **Step 4:** `npm test` → expect 1 passing.
- [ ] **Step 5:** Commit: `chore: add vitest`

---

### Task 2: Canonical position lists in utils

**Files:** Modify `src/utils.js`

**Produces:** `HISTORY_FILTER_POSITIONS: string[]` = `['BTN','CO','HJ','LJ','MP','UTG+1','UTG','SB','BB']`

- [ ] **Step 1:** Add after `TABLE_POSITIONS`:

```js
// Every distinct position across table sizes, late->early then blinds.
// History's position filter uses this so UTG/LJ/UTG+1 hands are filterable.
export const HISTORY_FILTER_POSITIONS = ['BTN', 'CO', 'HJ', 'LJ', 'MP', 'UTG+1', 'UTG', 'SB', 'BB'];
```

- [ ] **Step 2:** Commit: `feat(utils): canonical HISTORY_FILTER_POSITIONS`

---

### Task 3: Money helpers in utils (A, B, F, G)

**Files:** Modify `src/utils.js`, `test/utils.test.js`

**Produces:**
- `heroBlindPosted(hand, sb=1, bb=2): number` — `sb` if hero SB, `bb` if hero BB, else 0.
- `heroInvested(hand, sb=1, bb=2): number` — total chips hero put in across streets (voluntary + own blind). `0` for quick hands (no `actions`).
- `handNet(hand, opts={sb,bb}): number` — signed net chips for the hand (see code).
- `sumNet(hands, opts={sb,bb}): number` — sum of `handNet` over `hands.filter(h => !h.incomplete)`.

- [ ] **Step 1: Failing tests** — replace `test/utils.test.js` contents:

```js
import { describe, it, expect } from 'vitest';
import { handNet, heroInvested, heroBlindPosted, sumNet } from '../src/utils.js';

const wonHand = {
  myPosition: 'BTN',
  preflop: { actions: [
    { pos: 'BTN', action: 'raise', amount: 6 },
    { pos: 'BB', action: 'call', amount: 6 },
  ], pot: 13 },
  flop: { cards: ['2h','7d','Kc'], actions: [
    { pos: 'BB', action: 'check', amount: 0 },
    { pos: 'BTN', action: 'bet', amount: 8 },
    { pos: 'BB', action: 'fold', amount: 0 },
  ], pot: 21 },
  turn: { card: null, actions: [] },
  river: { card: null, actions: [] },
  result: { outcome: 'won', amount: '21' },
};

describe('heroInvested', () => {
  it('sums hero voluntary chips across streets', () => {
    expect(heroInvested(wonHand)).toBe(14); // 6 preflop + 8 flop
  });
  it('is 0 for a quick hand', () => {
    expect(heroInvested({ quick: true, result: { outcome: 'won', amount: '50' } })).toBe(0);
  });
});

describe('heroBlindPosted', () => {
  it('bb when hero is BB', () => { expect(heroBlindPosted({ myPosition: 'BB' }, 1, 2)).toBe(2); });
  it('0 when hero is in the field', () => { expect(heroBlindPosted({ myPosition: 'CO' }, 1, 2)).toBe(0); });
});

describe('handNet', () => {
  it('won = gross pot minus hero investment', () => {
    expect(handNet(wonHand, { sb: 1, bb: 2 })).toBe(7); // 21 - 14
  });
  it('folded in the BB costs one big blind', () => {
    const h = { myPosition: 'BB', preflop: { actions: [] }, result: { outcome: 'folded', amount: '' } };
    expect(handNet(h, { sb: 1, bb: 2 })).toBe(-2);
  });
  it('quick won uses the typed amount as net', () => {
    expect(handNet({ quick: true, result: { outcome: 'won', amount: '40' } })).toBe(40);
  });
  it('lost with recorded actions = minus hero investment', () => {
    const h = { ...wonHand, result: { outcome: 'lost', amount: '999' } };
    expect(handNet(h, { sb: 1, bb: 2 })).toBe(-14);
  });
});

describe('sumNet', () => {
  it('skips incomplete drafts', () => {
    const hands = [
      { quick: true, result: { outcome: 'won', amount: '10' } },
      { incomplete: true, result: { outcome: 'won', amount: '999' } },
    ];
    expect(sumNet(hands)).toBe(10);
  });
});
```

- [ ] **Step 2:** `npm test` → expect FAIL (helpers undefined).

- [ ] **Step 3: Implement** in `src/utils.js`:

```js
// Chips a single position put into one street. Mirrors PositionSequencer
// committed-tracking: bet/raise `amount` is the raise-TO total; call `amount`
// is the full call price. `seed` = chips already posted (hero blind, preflop).
function positionStreetContribution(actions, pos, seed = 0) {
  let committed = seed;
  for (const a of actions || []) {
    if (a.pos !== pos) continue;
    if (a.action === 'bet' || a.action === 'raise' || a.action === 'call') {
      committed = Math.max(committed, Number(a.amount) || 0);
    }
  }
  return committed;
}

export function heroBlindPosted(hand, sb = 1, bb = 2) {
  if (hand?.myPosition === 'SB') return sb;
  if (hand?.myPosition === 'BB') return bb;
  return 0;
}

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

export function handNet(hand, opts = {}) {
  const sb = opts.sb ?? 1;
  const bb = opts.bb ?? 2;
  const r = hand?.result || {};
  const amt = Number(r.amount) || 0;
  if (hand?.quick) {
    if (r.outcome === 'won' || r.outcome === 'split') return amt;
    if (r.outcome === 'lost') return -Math.abs(amt);
    return 0;
  }
  switch (r.outcome) {
    case 'won':   return amt - heroInvested(hand, sb, bb);
    case 'lost': {
      const invested = heroInvested(hand, sb, bb);
      return invested > 0 ? -invested : -Math.abs(amt);
    }
    case 'split': return amt !== 0 ? amt : -heroInvested(hand, sb, bb);
    case 'folded': return -heroBlindPosted(hand, sb, bb);
    default: return 0;
  }
}

export function sumNet(hands, opts = {}) {
  return (hands || [])
    .filter(h => !h.incomplete)
    .reduce((s, h) => s + handNet(h, opts), 0);
}
```

- [ ] **Step 4:** `npm test` → expect PASS.
- [ ] **Step 5:** Commit: `feat(utils): handNet/heroInvested/sumNet — single source of truth for hand results`

---

### Task 4: HandRecorder blind math + net preview (E, B)

**Files:** Modify `src/screens/HandRecorder.jsx`

- [ ] **Step 1:** `const preflopStartPot = sb + bb;` (was `Math.round(1.5 * bb)`).
- [ ] **Step 2:** Add `sb={sb}` next to `bb={bb}` on all 4 `<PositionSequencer/>` call sites (preflop, flop, turn, river).
- [ ] **Step 3:** Import `handNet` from `../utils`. Under the amount input in Step 6, for non-folded outcomes:

```jsx
{hand.result.outcome && hand.result.outcome !== 'folded' && (
  <div className="text-muted text-xs mt-4">
    Net this hand: {sym}{handNet(
      { myPosition: hand.myPosition,
        preflop: { actions: hand.preflop.actions },
        flop:    { actions: hand.flop.actions },
        turn:    { actions: hand.turn.actions },
        river:   { actions: hand.river.actions },
        result:  hand.result },
      { sb, bb }
    ).toLocaleString()}
  </div>
)}
```

- [ ] **Step 4:** `npm run build` → clean.
- [ ] **Step 5:** Commit: `fix(recorder): real SB in preflop pot, pass sb to sequencer, show computed net`

---

### Task 5: SessionView net (A, G)

**Files:** Modify `src/screens/SessionView.jsx`

- [ ] **Step 1:** Import `sumNet, parseBB, parseSB` from `../utils`.
- [ ] **Step 2:** Replace the inline `netResult` reduce (~lines 278-284) with:

```js
const netResult = sumNet(completedHands, {
  sb: parseSB(session.game),
  bb: parseBB(session.game),
});
```

- [ ] **Step 3:** `npm run build` → clean.
- [ ] **Step 4:** Commit: `fix(session): net result via sumNet (subtract hero investment)`

---

### Task 6: Home counts + net (A, C, G)

**Files:** Modify `src/screens/Home.jsx`

- [ ] **Step 1:** Import `sumNet, parseBB, parseSB`.
- [ ] **Step 2:** In the `Promise.all` loop body:

```js
const real = hands.filter(h => !h.incomplete);
counts[session.id] = real.length;
nets[session.id] = sumNet(real, { sb: parseSB(session.game), bb: parseBB(session.game) });
```

- [ ] **Step 3:** `npm run build` → clean.
- [ ] **Step 4:** Commit: `fix(home): exclude drafts from counts, net via sumNet`

---

### Task 7: History filter + net (A, C, D, G)

**Files:** Modify `src/screens/History.jsx`

- [ ] **Step 1:** Import `sumNet, HISTORY_FILTER_POSITIONS, parseBB, parseSB`.
- [ ] **Step 2:** In `filtered`, first predicate: `if (h.incomplete) return false;`
- [ ] **Step 3:** Replace `const POSITIONS = [...]` with `const POSITIONS = HISTORY_FILTER_POSITIONS;`
- [ ] **Step 4:** Replace the inline `totalNet` reduce with:

```js
const totalNet = filtered.reduce((s, h) => {
  const sess = sessions.find(x => x.id === h.sessionId);
  return s + sumNet([h], { sb: parseSB(sess?.game), bb: parseBB(sess?.game) });
}, 0);
```

- [ ] **Step 5:** `npm run build` → clean.
- [ ] **Step 6:** Commit: `fix(history): drop drafts, real position filter, net via sumNet`

---

### Task 8: HandDetail net line (A, B)

**Files:** Modify `src/screens/HandDetail.jsx`

- [ ] **Step 1:** Import `handNet, parseBB, parseSB`. Load the hand's session (`get('sessions', hand.sessionId)` in the existing effect) into state `session`; fall back to `{}` if absent.
- [ ] **Step 2:** In the result summary (~lines 259-261), for non-folded outcomes, append a line:

```js
const net = handNet(hand, { sb: parseSB(session?.game), bb: parseBB(session?.game) });
// render: `Net ${sym}${net.toLocaleString()}` with class net >= 0 ? 'result-won' : 'result-lost'
```

- [ ] **Step 3:** `npm run build` → clean.
- [ ] **Step 4:** Commit: `fix(hand-detail): show true net for the hand`

---

### Task 9: QuickHandEntry (C, D)

**Files:** Modify `src/screens/QuickHandEntry.jsx`

- [ ] **Step 1:** Import `TABLE_POSITIONS` from `../utils`.
- [ ] **Step 2:** `const handNum = prevHands.filter(h => !h.incomplete).length + 1;`
- [ ] **Step 3:** Delete the module-level `QUICK_POSITIONS`; inside the component (after the `if (!session)` guard) use
  `const positions = TABLE_POSITIONS[session.totalSeats] || TABLE_POSITIONS[9];` and map `positions` in the grid.
- [ ] **Step 4:** `npm run build` → clean.
- [ ] **Step 5:** Commit: `fix(quick): drop drafts from hand number, positions match table size`

---

### Task 10: Share computeStreetState, fix calcPosition, delete dead code (D, G)

**Files:** Modify `src/utils.js`, `src/components/PositionSequencer.jsx`; Delete `src/components/{ActionSequencer,PotBuilder,StreetEntry,CardPicker}.jsx`

- [ ] **Step 1:** Move `computeStreetState` from `PositionSequencer.jsx` into `src/utils.js` as `export function computeStreetState(actions, actionOrder, activePositions, initialBet, initialCommitted = {})`. Add `committed` to **both** `return` objects inside it (it already maintains the `committed` map). Import it back into `PositionSequencer.jsx`; keep `actionBadge` local to the component.
- [ ] **Step 2:** Rewrite `positionStreetContribution` (Task 3) to delegate:

```js
function positionStreetContribution(actions, pos, seed = 0) {
  const order = [...new Set((actions || []).map(a => a.pos))];
  if (!order.includes(pos)) order.push(pos);
  const { committed } = computeStreetState(
    actions || [], order, order, 0, seed ? { [pos]: seed } : {}
  );
  return committed?.[pos] ?? seed;
}
```

- [ ] **Step 3:** Re-run `npm test` — the Task 3 expectations must still hold (6 preflop + 8 flop = 14; folded BB = −2). Adjust only if `computeStreetState` genuinely computes a different (more correct) number, and note it.
- [ ] **Step 4:** Fix `calcPosition` maps to canonical names:

```js
if (totalSeats === 6) { const map = { 3: 'UTG', 4: 'HJ', 5: 'CO' }; return map[offset] || 'MP'; }
if (totalSeats === 8) { const map = { 3: 'UTG', 4: 'UTG+1', 5: 'LJ', 6: 'HJ', 7: 'CO' }; return map[offset] || 'MP'; }
if (totalSeats === 9) { const map = { 3: 'UTG', 4: 'UTG+1', 5: 'MP', 6: 'LJ', 7: 'HJ', 8: 'CO' }; return map[offset] || 'MP'; }
```

- [ ] **Step 5:** `git rm src/components/ActionSequencer.jsx src/components/PotBuilder.jsx src/components/StreetEntry.jsx src/components/CardPicker.jsx`. Then `grep -rn "ActionSequencer\|PotBuilder\|StreetEntry\|CardPicker'" src/` → expect no results (InlineCardPicker is a different file — fine).
- [ ] **Step 6:** `npm test` + `npm run build` → both clean.
- [ ] **Step 7:** Commit: `refactor: share computeStreetState, canonical calcPosition, drop dead recorder components`

---

### Task 11: Manual verification in browser

- [ ] **Step 1:** `npm run dev`; open via claude-in-chrome MCP (gstack/playwright unavailable on this machine).
- [ ] **Step 2:** New session `NL $1/$2`, 6-max. Record: hero BTN raise to 6, BB calls, flop hero bets 8, BB folds → outcome auto "won", amount ~21. "Net this hand" preview should read roughly pot(21) − hero invested(14) = **+7**, not +21.
- [ ] **Step 3:** SessionView header net should equal that +7, not +21.
- [ ] **Step 4:** Record a fold from the BB. SessionView net drops by exactly 2.
- [ ] **Step 5:** Start a hand, pick hole cards, navigate away (creates a draft). Home hand-count and History must **not** include it.
- [ ] **Step 6:** History → filter position `UTG` → matches UTG hands (previously always empty).
- [ ] **Step 7:** Commit any tweaks: `test: manual verification pass`

---

## Self-Review

- Coverage: **A** Tasks 3,5,6,7,8 · **B** 3,4 · **C** 6,7,9 · **D** 2,7,9,10 · **E** 4 · **F** 3 · **G** 3 + 5–8, 10.
- No schema bump — `handNet` reads the stored hand shape as-is.
- Type consistency: `handNet(hand, {sb,bb})`, `sumNet(hands, {sb,bb})`, `heroInvested(hand, sb, bb)`, `heroBlindPosted(hand, sb, bb)`, `computeStreetState(actions, order, active, initialBet, initialCommitted) -> { nextPos, currentBet, runningPot, foldedSet, lastActionByPos, toCall, committed }` — consistent across Tasks 3, 4, 8, 10.
- **Open risk to confirm with user before Task 5:** for `lost` hands that have recorded actions, `handNet` returns `−heroInvested` (ground truth from actions) instead of the user's typed "amount lost". Existing lost hands where the user under-recorded streets will show a different (usually smaller) loss. Alternative: keep `−|amount|` for `lost` always and only fix `won`/`split`.
