# Recorder Feedback (first real use) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Act on the user's first-use feedback (2026-11-11).

## User feedback → decisions

1. Venue, blinds level and currency: typed the first time, then picked from options.
2. Quick entry has no review value → **remove Quick** (old quick hands still display and net as before).
3. Recorder:
   - Tap a seat = call/check **and** the raise sizes appear at the same time (one tap fewer).
   - When the round is known to be finished, auto-advance to the next street.
   - When it is not known (seats after the last tap haven't acted), show an explicit button naming them: "SB, BB fold → Flop".
   - A new street's actions are locked until its board cards are picked.
   - Easy way back: header says "← Back" (not "Cancel") after step 0; Undo with no taps on a street goes back to the previous street.
   - Editing an earlier street re-validates later streets (no stale actions for players who are now out).

## Tasks

### Task 1 — pure helpers (`src/utils.js`, TDD)
- `revalidateStreets(streets, hero, {totalSeats, sb, bb})`: keep each street's longest valid prefix given the live seats left by earlier streets (relocateHero reuses it).
- `pendingFolds(taps, ctx)`: seats that "Done" would fold (in order); empty when the street is closed or hero still has to act.
- `recentValues(sessions, key, filter?)`: distinct non-empty values, most recent first, case-insensitive de-dup.

### Task 2 — remove Quick
- Delete `QuickHandEntry.jsx`, its route and the Quick button. Keep `quick` support in money helpers for old hands.

### Task 3 — SessionSetup options
- Venue chips from `recentValues(sessions, 'venue')`; game chips from sessions in the selected currency; "+ New" reveals the text input (shown directly when there is no history). Picking a chip triggers the rake auto-fill.

### Task 4 — Sequencer + recorder
- Tap seat → facing tap + size panel open for that seat.
- "Done" becomes "SB, BB fold → Flop" (names from `pendingFolds`); "Your action first" when hero is pending.
- Street header banner (PRE-FLOP / FLOP + board); flop/turn/river actions disabled until cards are picked.
- "← Back" label; Undo with no taps → previous street.
- `HandRecorder` runs `revalidateStreets` whenever a street's actions change.

### Task 5 — verify
- Vitest, build, lint ≤ 9; headless: tap → panel shows at once; pending-fold button; locked flop until cards; back across streets; preflop edit drops a now-folded player's flop action; setup chips.
