# Fast Sequencer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record a street by tapping only the seats that acted (untapped = fold), and let hero fold straight to the Result step with the correct loss.

**Architecture:** Spec: `docs/superpowers/specs/2026-09-10-recorder-fast-sequencer-design.md`. The stored hand shape (`actions: [{pos, action, amount}]`) does not change. `PositionSequencer` becomes a controlled view over a chronological **tap log** derived from the stored actions (`tapsFromActions`). `materializeStreet` replays the tap log through `computeStreetState`, emitting `fold` for every seat skipped between taps (and, on close, for every seat still due to act). Pure logic lives in `src/utils.js` and is unit-tested; the component only wires gestures to it.

**Tech Stack:** React 19, Vite 7, Vitest 3, IndexedDB via `idb`.

## Global Constraints

- No change to the IndexedDB schema or the `hands` record shape.
- UI copy in English (matches the rest of this app).
- `PositionSequencer` keeps its existing props; adds optional `prevPreflopActions`; `onComplete` now receives the final `actions` array.
- Hero is never an implied fold. Hero folding is an explicit action and ends the hand (go to Result, outcome `folded`).
- All-in, straddles, antes: out of scope.

## Deviations from the spec (decided while planning)

1. Spec's `pos -> taps` map loses cross-seat ordering in raise wars → use a chronological tap log; skipped seats fold.
2. Spec's long-press-to-clear → an explicit **Undo** button (removes last tap). Discoverable, no hidden gesture.
3. Spec's "Folds to hero" button is redundant — tapping hero's tile already folds everyone skipped before hero. A walk is just **Done** with zero taps.
4. Spec says hero fold is chosen at Result as `Folded`, but full hands have no such option and `handNet('folded')` only subtracts the blind. Add an **I fold** button in the sequencer, a **Folded** option at Result, and make `folded` net `−heroInvested` for full hands.

---

### Task 1: Pure street logic in utils

**Files:**
- Modify: `src/utils.js` (append helpers; change `folded` case of `handNet`)
- Test: `test/fast-sequencer.test.js` (new)

**Interfaces — Produces:**
- `materializeStreet(taps, ctx) -> { actions, nextPos, error }` where `ctx = { actionOrder, activePositions, initialBet, initialCommitted, hero, close }`, `error ∈ null | 'hero-skipped' | 'not-live'`
- `tapsFromActions(actions, hero) -> taps` (drops non-hero folds)
- `facingTap(taps, pos, ctx) -> {pos, action: 'call'|'check', amount}`
- `betTap(tapsBefore, pos, amount, ctx) -> {pos, action: 'bet'|'raise', amount} | null`

- [ ] **Step 1: Write failing tests** — `test/fast-sequencer.test.js` covering: raise + caller closed (others fold, pot 12); open view (only skipped seats fold, `nextPos` = next due); 3-bet + opener call keeps order (pot 36); walk with hero BB and zero taps (no error); closing past un-acted hero → `'hero-skipped'`; a tap that skips hero → `'hero-skipped'`; postflop checked through (no folds); postflop bet takes it down (skipped seats fold); `tapsFromActions` drops implied folds but keeps hero's fold and round-trips; `facingTap` call vs BB option check vs postflop check; `betTap` raise / bet / null-when-too-small; `handNet` folded full hand = −invested (call 6 then fold flop → −6; BB no action → −2).

- [ ] **Step 2: Run, verify fail** — `npx vitest run test/fast-sequencer.test.js` → FAIL (`materializeStreet is not a function`; folded −6 test gets 0).

- [ ] **Step 3: Implement** — change the full-hand `folded` case to `net = -heroInvested(hand, sb, bb)` (heroInvested already includes hero's blind), and append to `src/utils.js`:

```js
export function materializeStreet(taps, ctx) {
  const { actionOrder, activePositions, initialBet = 0, initialCommitted = {}, hero = null, close = false } = ctx;
  const actions = [];
  const nextOf = () =>
    computeStreetState(actions, actionOrder, activePositions, initialBet, initialCommitted).nextPos;
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
    actions.push({ pos: t.pos, action: t.action, amount: t.amount || 0 });
  }
  if (close) {
    const err = foldUntil(null);
    if (err) return { actions, nextPos: nextOf(), error: err };
  }
  return { actions, nextPos: nextOf(), error: null };
}

export function tapsFromActions(actions, hero) {
  return (actions || [])
    .filter(a => a.action !== 'fold' || a.pos === hero)
    .map(a => ({ pos: a.pos, action: a.action, amount: a.amount || 0 }));
}

function streetStateAfter(taps, ctx) {
  const { actions } = materializeStreet(taps, { ...ctx, close: false });
  return computeStreetState(actions, ctx.actionOrder, ctx.activePositions, ctx.initialBet || 0, ctx.initialCommitted || {});
}

export function facingTap(taps, pos, ctx) {
  const { currentBet, committed } = streetStateAfter(taps, ctx);
  return currentBet - (committed[pos] || 0) > 0
    ? { pos, action: 'call', amount: currentBet }
    : { pos, action: 'check', amount: 0 };
}

export function betTap(tapsBefore, pos, amount, ctx) {
  const { currentBet } = streetStateAfter(tapsBefore, ctx);
  if (!isValidBetAmount(amount, currentBet)) return null;
  return { pos, action: currentBet > 0 ? 'raise' : 'bet', amount: Number(amount) };
}
```

- [ ] **Step 4: Run all tests** — `npx vitest run` → all pass.
- [ ] **Step 5: Commit** — `feat(utils): tap-log street materialisation; folded nets −invested`

---

### Task 2: Rewrite `PositionSequencer` as a tap-only recorder

**Files:** Modify `src/components/PositionSequencer.jsx` (full rewrite, same props + `prevPreflopActions`); `src/index.css` (append `.seq-hint`, `.seq-controls`, `.pos-implied`).

**Consumes:** Task 1 helpers. **Produces:** `onChange(actions, endPot)` (open view while editing, closed view on finish); `onComplete(actions)` with the final actions.

Behaviour:
- Grid in action order. Tile shows its latest badge from the materialised open view; implied folds styled `.pos-implied`; the seat due next is highlighted.
- Tap a seat → append `facingTap`. Tap the **last-tapped** seat again → size panel for it; a chip / manual amount **replaces** that last tap via `betTap` (invalid → disabled + hint).
- Seats whose tap would skip hero (or are already out) are disabled.
- Controls: **Undo** (drop last tap), **I fold** (hero explicit fold → `onComplete` immediately), **Done →** (close street; disabled with "Your action first" when closing would skip hero).
- Auto-advance 800 ms after a tap leaves `nextPos === null` (skip on mount).
- Pre-flop, no taps, `prevPreflopActions` given: **Same as last hand** → longest valid prefix of that hand's non-fold taps.
- Size chips: pre-flop unraised `2.5/3/4/5bb`; facing a bet `×2.5/×3/×4` (rounded to BB); post-flop unbet `1/3, 1/2, 2/3, Pot` of the pot before the tap.

- [ ] `npm run build` passes; no new lint errors. Commit — `feat(recorder): fast sequencer — tap only seats that acted`

---

### Task 3: Wire into `HandRecorder` + hero-fold Result

**Files:** Modify `src/screens/HandRecorder.jsx`

- `afterStreet(street, actions)`: hero folded in `actions` → `result = { outcome: 'folded', amount: '', winner: '' }`, step 6. Else live seats computed from `actions` (not stale state): ≤ 1 → step 6, otherwise next street.
- `init()` loads `prevPreflopActions`: highest-`handNum` completed non-quick hand in the session (excluding the hand being edited) with pre-flop actions.
- Result: "You folded" banner; **Folded** choice beside the winners; no amount input for `folded`; "Net this hand" shown for `folded` too.

- [ ] Commit — `feat(recorder): hero fold jumps to Result; same-as-last-hand source`

---

### Task 4: Show the cost of folded hands in lists

**Files:** `src/screens/SessionView.jsx`, `src/screens/History.jsx`, `src/screens/HandDetail.jsx`

- Folded rows: `Fold` when net is 0, else `Fold −2`. HandDetail shows the `Net:` line for folded hands.

- [ ] Commit — `fix(ui): folded rows show what the fold cost`

---

### Task 5: Verify end to end

- [ ] `npx vitest run` green; `npm run build`; lint error count ≤ 10 (pre-existing).
- [ ] Headless browser (playwright-core from `../school-calendar/web/node_modules`; seed a draft at step 2 via IndexedDB):
  1. 9-max, hero BTN: UTG tap ×2 → 3bb chip, tap BTN, Done → flop shows only UTG + BTN; ≤ 5 taps.
  2. Raise war: UTG raise, BTN 3-bet, UTG call → pot correct.
  3. Hero CO calls UTG raise; flop UTG bets, hero **I fold** → Result "You folded", net −6, row shows `Fold −6`.
  4. Walk: hero BB, Done with zero taps → Result auto "won", net +1.
  5. Size panel not hidden behind the sticky bottom bar.
