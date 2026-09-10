# Faster Hand Recorder — Fast Sequencer Design

**Date:** 2026-09-10
**Status:** Approved (brainstorming), pending implementation plan

## Problem

Recording a hand takes too many taps. The 7-step wizard
(`My Position -> My Cards -> Pre-flop -> Flop -> Turn -> River -> Result`) is
not the issue — steps auto-advance already. The cost is inside the four
street steps: `PositionSequencer` walks the user through **every** seat one
at a time, so a 9-handed pre-flop that folds around to a single raiser and
one caller is ~9 taps. The user records every player's action (they do full
hand replay in review), so we cannot capture less — we must capture the
same data with far fewer taps.

## Core change

**Only tapped players did something. Everything untapped is a fold.**

Per street, the user taps only the seats that voluntarily acted
(open / call / check / bet / raise). Every in-hand seat the user did not
tap is recorded as `fold` when the street is completed. The stored data
model is unchanged — `actions: [{ pos, action, amount }]` — so
`computeStreetState`, `heroInvested`, pot math, and "who is still in"
all keep working. Only the input UI changes.

Example: 9-handed, UTG opens 2.5bb, BTN calls, rest fold ->
**2 taps** (UTG then a size chip; BTN) instead of ~9.

## Unchanged

- Steps `My Position`, `My Cards`, `Result`, and the board-card pickers.
- Hero folding a hand is recorded at the `Result` step by choosing
  `Folded` — never in the sequencer.
- Street auto-advance to the next step after a street completes.
- The `hands` IndexedDB record shape and every downstream consumer.

## New `PositionSequencer` interaction

State: a local `taps` map, `pos -> [{ action, amount }]` (array to allow a
player acting twice in a raise war). Untapped `pos` = no entry.

| Gesture | Result |
| ------- | ------ |
| Tap a seat with no entry | Add `call` if the seat faces a bet (`currentBet > committed[pos]`), else `check`. |
| Tap a seat whose last entry predates the current bet level | Add a **new** facing action: `call` to `currentBet`. |
| Tap a seat whose last entry **is** at the current bet level | Enter bet/raise mode: show inline size chips under that seat. |
| Tap a size chip | Commit `{ action: currentBet > 0 ? 'raise' : 'bet', amount }` immediately (no confirm). Chips: 2.5bb / 3bb / 4bb / 5bb pre-flop opens, x2.5 / x3 / x4 of current bet when facing a raise, 1/2 / 2/3 / pot post-flop, plus a manual number field. |
| Long-press a seat with entries | Clear that seat's entries (back to implied-fold). |
| Tap **"Folds to hero" ("全 fold，到我")** | Mark every not-yet-acted seat before hero as `fold`, jump the active marker to hero, and (pre-flop, if hero is BB with no raise) offer the walk. |
| Tap **"Same as last hand" ("同上一手")** (pre-flop only) | Pre-fill `taps` from the previous completed hand's pre-flop actions, matched by position name. Seats whose action differs this hand are then edited normally. Button hidden if there is no previous hand in the session. |
| Tap **"Done" ("完成呢街 ->")** | Materialise the street (see below) and advance. |

An unambiguous close still auto-advances (a `call` that leaves no seat to
act, as today). `Done` covers checked-through streets and fold-arounds.

### Materialisation (on street completion)

Given `actionOrder` (positional) and the seats still live entering this
street (not folded on an earlier street):

1. Walk `actionOrder`. For each seat, emit its tapped entries in order; if
   it has none, emit one `{ pos, action: 'fold', amount: 0 }`.
2. For a raise war, a seat's later `call`/`fold` entries are emitted after
   the raise that prompted them, preserving the existing multi-action
   semantics `computeStreetState` already supports.
3. Feed the resulting `actions` array to `computeStreetState` exactly as
   today to get `endPot`, folded set, and remaining players.

Hero is always live and always emitted with a real action (hero cannot be
an implied fold — hero folding ends the hand at `Result`).

### Edge cases

- **Walk (folds to BB):** `Done` / "folds to hero" with zero taps pre-flop
  and hero in BB -> hand ends, `Result` pre-set to a won walk of the
  blinds; `handNet` already nets hero's own BB back out.
- **Limped pot:** tap each limper (`call`), tap BB (`check`).
- **3-bet / 4-bet:** tap opener (chip), tap 3-bettor (chip), tap opener
  again (`call` to the new level, or long-press = fold).
- **All-in:** out of scope for this change; user types the amount via the
  manual field, no special "all-in" flag.
- **Multiway post-flop where only one seat is tapped:** the other live
  seats become folds on `Done` — correct for a bet that took it down.

## Files touched

- `src/components/PositionSequencer.jsx` — rewritten interaction; keeps the
  same props (`totalSeats, street, myPosition, activePositions, actions,
  onChange, startPot, bb, sb, currency, onComplete`) and still calls
  `onChange(actions, endPot)` with the same array shape.
- `src/screens/HandRecorder.jsx` — pass the previous completed hand's
  pre-flop actions to `PositionSequencer` for the "same as last hand"
  button (new prop `prevHandPreflopActions`); no other change.
- `src/utils.js` — no change to `computeStreetState`; add a small helper
  `materializeStreet(taps, actionOrder, liveSeats, initialBet, initialCommitted)`
  returning the `actions` array, unit-tested.
- No IndexedDB, schema, or results-math change.

## Testing

- Unit-test `materializeStreet` in `test/utils.test.js`: fold-around,
  limped pot, single raiser + caller, 3-bet + call, checked-through
  post-flop, hero-in-BB walk. Assert the produced `actions` array and that
  `computeStreetState` on it yields the expected `endPot` and remaining
  seats.
- Manual browser pass: record a 9-handed hand end to end, confirm tap
  count and that `SessionView` / `HandDetail` replay it identically to a
  hand entered the old way.

## Out of scope

Single-scroll layout (was "Approach 2"), all-in tracking, straddles,
ante games, changes to card entry or the Result step.
