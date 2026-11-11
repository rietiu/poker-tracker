# All-in / Side Pots, Rake Profiles, Edit Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close review items #5, #6, #9, #10 as decided by the user on 2026-11-11.

**Architecture:** All money/action logic stays pure in `src/utils.js` (unit-tested); a new `src/pots.js` owns contributions → pots → rake. Screens only wire UI to it. Stored hand shape stays backward-compatible: new optional fields only (`action.allIn`, `result.pots`, `session.jackpot`).

**Tech Stack:** React 19, Vite 7, Vitest 3.

## User decisions (2026-11-11)

- **#5** Edit changes the pot → show "Pot is now $X — Recalculate"; one tap applies it. Never auto-overwrite.
- **#6** Hero changes position after recording → hero's actions move with hero to the new seat, replacing whatever that seat had; the old seat becomes "never acted". Actions that no longer fit the order are dropped; anything missing the user re-enters. Hero's actions must never end up on another player.
- **#9** Full side pots. All-in amount = that player's whole stack (no separate stack entry). Result step picks winner(s) per pot.
- **#10** Hands that end pre-flop: no rake, no jackpot. Rake on the called pot only (uncalled bets are returned). Per-session settings: % or flat, cap, and a fixed jackpot amount per hand (separate from the cap). New sessions auto-fill these from the latest session with the same venue + game.

## Global Constraints

- No IndexedDB schema/version change.
- Old hands (no `allIn`, no `result.pots`) must render and net exactly as before.
- UI copy English.

---

### Task 1: All-in in the street engine (`src/utils.js`)

- `computeStreetState(actions, order, active, initialBet, initialCommitted, allInBefore = [])`: positions in `allInBefore` or with an `allIn` action this street never act again; if no player can act, or only one can and owes nothing, `nextPos = null`.
- `materializeStreet` ctx gains `allInBefore`; `tapsFromActions` keeps `allIn`.
- `allInTap(tapsBefore, pos, amount, ctx)`: amount > what pos already committed; `raise`/`bet` if above the current bet, else `call` for less; `allIn: true`.
- Tests: short all-in call closes action; all-in raise reopens; later street skips all-in seat; single remaining actor with nothing to call → street done.

### Task 2: Pots and rake (`src/pots.js`)

- `handContributions(hand, sb, bb)` → `{pos: chips}` over all streets (blinds included).
- `buildPots(contributions, foldedSet)` → `{ pots: [{amount, eligible}], uncalled: {pos, amount} | null }` — standard layering; a top layer only one player paid for is returned to them (uncalled).
- `computeRake(calledPot, sawFlop, cfg)` → `{ rake, jackpot, total }`; `cfg = {rakeType, rake, rakeMax, jackpot}`; pre-flop → 0.
- `heroTake(potsWithWinners, hero, rakeTotal, uncalled)` → chips pushed to hero (rake/jackpot come out of the main pot; split pots divide evenly; hero's uncalled return included).
- Tests: heads-up no all-in; short-stack all-in 3-way (main + side); uncalled river bet; walk; rake cap; jackpot only post-flop.

### Task 3: Hero relocation (`relocateHero` in `src/utils.js`)

- `relocateHero(streets, oldPos, newPos, {totalSeats, sb, bb})` → new `{preflop, flop, turn, river}` action arrays: per street, drop `newPos` taps, relabel `oldPos` taps → `newPos`, keep the longest valid prefix, close the street when possible.
- Tests: CO→BTN keeps call and BTN's old call is gone; a move that breaks order drops the invalid tail; hero fold moves too.

### Task 4: Session rake settings

- `SessionSetup`: add "Jackpot per hand" field; when venue + game match a previous session (case-insensitive, trimmed), auto-fill rake type/amount/cap/jackpot unless the user already edited those fields.
- Recorder's inline "rake not set" prompt also takes jackpot.

### Task 5: Sequencer + recorder wiring

- Size panel gets **All-in** (amount input + button) via `allInTap`; tile badge shows `AI`.
- `HandRecorder` passes `allInBefore` per street; a street with nobody able to act auto-skips.
- Result step: build pots from contributions; one pot → existing winner UI; several pots → per-pot winner toggles (multi-select = split). Rake/jackpot via `computeRake`. `result.amount` = `heroTake`, `result.pots` stored.
- #5: when `result.amount` ≠ the suggested take, show "Pot is now … — Recalculate".
- #6: changing position at step 0 with actions recorded runs `relocateHero`.

### Task 6: Verify

- Vitest green; build; lint count not higher than 9.
- Headless browser: 3-way all-in with side pot; walk shows no rake; flop pot pays rake + jackpot; edit hand → recalc hint; CO→BTN relocation.
