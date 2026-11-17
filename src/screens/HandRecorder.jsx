import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { get, getHandsBySession, put, del } from '../db';
import { uuid, parseBB, parseSB, TABLE_POSITIONS, formatCard, isRedCard, handNet, heroInvested, nextHandNum, relocateHero, revalidateStreets, positionAmong, buttonSeatAmong, activeSeatNums, seatingAtHand, SEAT_OUT, cbetHint, clockOf, handTimeFrom } from '../utils';
import { handContributions, buildPots, computeRake, heroTake, endedPreflop, foldedPositions } from '../pots';
import { isMtt, handBlinds, lastHandBlinds, chipSym, bbCount, levelLabel, shouldRederive, stackRows, cleanStacks } from '../mtt';
import InlineCardPicker from '../components/InlineCardPicker';
import PositionSequencer from '../components/PositionSequencer';
import PositionBadge from '../components/PositionBadge';

const STEPS = ['My Position', 'My Cards', 'Pre-flop', 'Flop', 'Turn', 'River', 'Result'];
const TOTAL = STEPS.length;

function allCards(hand) {
  const cards = [];
  if (hand.holeCards) cards.push(...hand.holeCards.filter(Boolean));
  if (hand.flop?.cards) cards.push(...hand.flop.cards.filter(Boolean));
  if (hand.turn?.card) cards.push(hand.turn.card);
  if (hand.river?.card) cards.push(hand.river.card);
  return cards;
}

// Get positions that folded in a street's actions
function getFoldedPositions(actions) {
  return new Set((actions || []).filter(a => a.action === 'fold').map(a => a.pos));
}

// Small hole card display for the sticky bar
function MiniCard({ card }) {
  if (!card) return <span className="mini-card mini-card-empty">?</span>;
  const red = isRedCard(card);
  return (
    <span className={`mini-card${red ? ' red' : ''}`}>
      {formatCard(card)}
    </span>
  );
}

// MTT: this hand's blinds. An old `level` tag is kept only while the numbers are unchanged.
function blindsPayload(base, sb, bb, ante) {
  const same = base && Number(base.sb) === sb && Number(base.bb) === bb && Number(base.ante) === ante;
  return same ? { ...base, sb, bb, ante } : { sb, bb, ante };
}

export default function HandRecorder() {
  const { id: routeSessionId, handId, resumeId } = useParams();
  const isEditMode = !!handId;   // editing a completed hand
  const isResumeMode = !!resumeId; // continuing an existing draft
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [resolvedSessionId, setResolvedSessionId] = useState(routeSessionId || null);
  const [step, setStep] = useState(0);
  const [hand, setHand] = useState({
    myPosition: '',
    holeCards: [null, null],
    stacks: {},
    preflop: { actions: [], notes: '', endPot: 0 },
    flop: { cards: [null, null, null], actions: [], notes: '', endPot: 0 },
    turn: { card: null, actions: [], notes: '', endPot: 0 },
    river: { card: null, actions: [], notes: '', endPot: 0 },
    result: { outcome: '', amount: '', notes: '', winner: '' },
    playedTime: clockOf(new Date().toISOString()), // "HH:MM" when the hand was played; '' = unknown
  });

  const [bb, setBb] = useState(2);
  const [sb, setSb] = useState(1);
  const [ante, setAnte] = useState(0);
  const [blindStr, setBlindStr] = useState({ sb: '', bb: '', ante: '' }); // MTT: raw inputs for this hand's blinds
  const [blindsBase, setBlindsBase] = useState(null); // MTT: blinds the hand loaded with (may carry an old `level`)
  const derivedBlindsRef = useRef({ sb: 0, bb: 0, ante: 0 }); // blinds the streets/pots were last derived with
  const [draftId, setDraftId] = useState(null);
  const [editRecord, setEditRecord] = useState(null); // original record when editing
  const [pendingRake, setPendingRake] = useState('');
  const [pendingRakeType, setPendingRakeType] = useState('percent');
  const [pendingRakeMax, setPendingRakeMax] = useState('');
  const [pendingJackpot, setPendingJackpot] = useState('');
  const [relocatedNote, setRelocatedNote] = useState('');
  // Pick my position by name, or by where the dealer button is (remembered per device).
  const [posMode, setPosMode] = useState(() => {
    try { return localStorage.getItem('poker-tracker:posMode') || 'position'; } catch { return 'position'; }
  });
  function choosePosMode(mode) {
    setPosMode(mode);
    try { localStorage.setItem('poker-tracker:posMode', mode); } catch { /* storage unavailable */ }
  }
  const [prevPreflopActions, setPrevPreflopActions] = useState(null);

  useEffect(() => {
    async function init() {
      let sid = routeSessionId;
      let existingBlinds;

      if (isEditMode) {
        // ── Edit a completed hand ─────────────────────────────────────────────
        const record = await get('hands', handId);
        if (!record) return;
        sid = record.sessionId;
        setResolvedSessionId(sid);
        setEditRecord(record);
        existingBlinds = record.blinds;
        setHand({
          myPosition: record.myPosition || '',
          holeCards: record.holeCards || [null, null],
          stacks: record.stacks || {},
          preflop: {
            actions: record.preflop?.actions || [],
            notes: record.preflop?.notes || '',
            endPot: record.preflop?.pot || 0,
          },
          flop: {
            cards: record.flop?.cards || [null, null, null],
            actions: record.flop?.actions || [],
            notes: record.flop?.notes || '',
            endPot: record.flop?.pot || 0,
          },
          turn: {
            card: record.turn?.card || null,
            actions: record.turn?.actions || [],
            notes: record.turn?.notes || '',
            endPot: record.turn?.pot || 0,
          },
          river: {
            card: record.river?.card || null,
            actions: record.river?.actions || [],
            notes: record.river?.notes || '',
            endPot: record.river?.pot || 0,
          },
          result: record.result || { outcome: '', amount: '', notes: '', winner: '' },
          playedTime: clockOf(record.playedAt),
        });
        setStep(6);
      } else if (isResumeMode) {
        // ── Resume an existing draft ──────────────────────────────────────────
        const record = await get('hands', resumeId);
        if (record?.incomplete) {
          sid = record.sessionId;
          setResolvedSessionId(sid);
          existingBlinds = record.draftState?.blinds ?? record.blinds;
          setDraftId(resumeId); // reuse the same draft ID so auto-save overwrites it
          if (record.draftState?.hand) {
            // Merge with default structure to guard against older draft formats
            const saved = record.draftState.hand;
            setHand({
              myPosition: saved.myPosition || '',
              holeCards: saved.holeCards || [null, null],
              stacks: saved.stacks || {},
              preflop: { actions: [], notes: '', endPot: 0, ...(saved.preflop || {}) },
              flop:    { cards: [null, null, null], actions: [], notes: '', endPot: 0, ...(saved.flop || {}) },
              turn:    { card: null, actions: [], notes: '', endPot: 0, ...(saved.turn || {}) },
              river:   { card: null, actions: [], notes: '', endPot: 0, ...(saved.river || {}) },
              result:  { outcome: '', amount: '', notes: '', winner: '', ...(saved.result || {}) },
              playedTime: saved.playedTime ?? clockOf(record.createdAt),
            });
          }
          if (record.draftState?.step != null) setStep(record.draftState.step);
        } else {
          setDraftId(uuid()); // fallback: draft gone, start fresh
        }
      } else {
        // ── New hand — always a fresh draft ───────────────────────────────────
        setDraftId(uuid());
      }

      // Previous full hand's pre-flop, for the "Same as last hand" shortcut
      const sessionHands = await getHandsBySession(sid);
      const prev = sessionHands
        .filter(h => !h.incomplete && !h.quick && h.id !== handId && h.preflop?.actions?.length)
        .sort((a, b) => (b.handNum || 0) - (a.handNum || 0))[0];
      setPrevPreflopActions(prev?.preflop?.actions || null);

      const s = await get('sessions', sid);
      setSession(s);
      if (s) {
        if (isMtt(s)) {
          // Own blinds (edit / resumed draft) → latest OTHER hand's blinds → old session level → blank
          const own = existingBlinds || (isEditMode ? handBlinds(s, null) : null);
          const others = sessionHands.filter(h => h.id !== handId && h.id !== resumeId);
          const start = own || lastHandBlinds(s, others);
          setBlindsBase(own ? { ...own } : null);
          setBlindStr({ sb: String(start.sb ?? ''), bb: String(start.bb ?? ''), ante: String(start.ante ?? '') });
          setSb(Number(start.sb) || 0); setBb(Number(start.bb) || 0); setAnte(Number(start.ante) || 0);
          derivedBlindsRef.current = { sb: Number(start.sb) || 0, bb: Number(start.bb) || 0, ante: Number(start.ante) || 0 };
        } else { setBb(parseBB(s.game)); setSb(parseSB(s.game)); }
      }
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save draft (create + resume modes) — only once at least one hole card is picked
  useEffect(() => {
    if (isEditMode || !draftId || !resolvedSessionId) return;
    if (!hand.holeCards.some(Boolean)) return; // nothing worth saving yet
    const timer = setTimeout(() => {
      put('hands', {
        id: draftId,
        sessionId: resolvedSessionId,
        incomplete: true,
        createdAt: new Date().toISOString(),
        myPosition: hand.myPosition,
        holeCards: hand.holeCards,
        ...(isMtt(session) ? { blinds: blindsPayload(blindsBase, sb, bb, ante) } : {}),
        draftState: { step, hand },
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [hand, step, draftId, resolvedSessionId, isEditMode, session, sb, bb, ante, blindsBase]);

  const blindsToSave = () => blindsPayload(blindsBase, sb, bb, ante);

  // Typing only updates the blind state; pots/actions are re-derived at commit points (commitBlinds).
  function setBlind(key, val) {
    const clean = val.replace(/[^\d]/g, '');
    setBlindStr(p => ({ ...p, [key]: clean }));
    const n = Number(clean) || 0;
    if (key === 'sb') setSb(n); else if (key === 'bb') setBb(n); else setAnte(n);
  }

  // Commit point (blur / leaving step 0 / before save). Returns the hand to use (state lags a render).
  function commitBlinds(h = hand) {
    if (!mtt) return h;
    const nb = { sb, bb, ante };
    if (!shouldRederive(derivedBlindsRef.current, nb, STREETS.some(st => h[st].actions.length > 0))) return h;
    const next = deriveHand(h, null, null, nb);
    setHand(next);
    return next;
  }

  function patchHand(patch) {
    setHand(prev => ({ ...prev, ...patch }));
  }

  function patchStreet(street, patch) {
    setHand(prev => ({ ...prev, [street]: { ...prev[street], ...patch } }));
  }

  // Derive my last action on a street by position
  function deriveMyAction(streetActions) {
    const mine = (streetActions || []).filter(a => a.pos === hand.myPosition);
    const last = mine[mine.length - 1];
    return { myAction: last?.action || '', myAmount: last?.amount || 0 };
  }

  async function saveRakeToSession() {
    const updated = {
      ...session,
      rakeType: pendingRakeType,
      rake: Number(pendingRake) || 0,
      rakeMax: Number(pendingRakeMax) || 0,
      jackpot: Number(pendingJackpot) || 0,
    };
    await put('sessions', updated);
    setSession(updated);
  }

  async function saveHand() {
    const sid = resolvedSessionId;
    const cur = commitBlinds();
    if (mtt && isEditMode && Number(editRecord?.blinds?.bb) > 0 && !(bb > 0)) return; // can't clear a real BB

    if (isEditMode && editRecord) {
      // Edit mode is only for completed hands — update in place
      const updated = {
        ...editRecord,
        ...(isMtt(session) ? { blinds: blindsToSave(), stacks: cleanStacks(hand.stacks) } : {}),
        myPosition: hand.myPosition,
        holeCards: cur.holeCards,
        preflop: {
          ...editRecord.preflop,
          pot: cur.preflop.endPot,
          notes: cur.preflop.notes,
          actions: cur.preflop.actions,
          ...deriveMyAction(cur.preflop.actions),
        },
        flop: cur.flop.cards.some(Boolean) ? {
          cards: cur.flop.cards,
          pot: cur.flop.endPot,
          notes: cur.flop.notes,
          actions: cur.flop.actions,
          ...deriveMyAction(cur.flop.actions),
        } : null,
        turn: cur.turn.card ? {
          card: cur.turn.card,
          pot: cur.turn.endPot,
          notes: cur.turn.notes,
          actions: cur.turn.actions,
          ...deriveMyAction(cur.turn.actions),
        } : null,
        river: cur.river.card ? {
          card: cur.river.card,
          pot: cur.river.endPot,
          notes: cur.river.notes,
          actions: cur.river.actions,
          ...deriveMyAction(cur.river.actions),
        } : null,
        result: cur.result,
        notes: cur.result.notes || '',
        playedAt: handTimeFrom(cur.playedTime, session?.date),
        updatedAt: new Date().toISOString(),
      };
      await put('hands', updated);
      navigate(`/hand/${handId}`);
      return;
    }

    // Create / resume mode — complete the draft and save as a proper hand record
    if (draftId) await del('hands', draftId);
    const prevHands = await getHandsBySession(sid);
    const handNum = nextHandNum(prevHands);

    const record = {
      id: uuid(),
      sessionId: sid,
      handNum,
      dealt: dealtCount,
      buttonSeat: buttonSeat || null,
      // who sat where for this hand — the basis for per-player notes later
      seating: buttonSeat ? seatingAtHand(session?.seats, activeSeats, mySeatNum, buttonSeat) : null,
      ...(isMtt(session) ? { blinds: blindsToSave(), stacks: cleanStacks(hand.stacks) } : {}),
      myPosition: hand.myPosition,
      holeCards: cur.holeCards,
      preflop: {
        pot: cur.preflop.endPot,
        notes: cur.preflop.notes,
        actions: cur.preflop.actions,
        ...deriveMyAction(cur.preflop.actions),
      },
      flop: cur.flop.cards.some(Boolean) ? {
        cards: cur.flop.cards,
        pot: cur.flop.endPot,
        notes: cur.flop.notes,
        actions: cur.flop.actions,
        ...deriveMyAction(cur.flop.actions),
      } : null,
      turn: cur.turn.card ? {
        card: cur.turn.card,
        pot: cur.turn.endPot,
        notes: cur.turn.notes,
        actions: cur.turn.actions,
        ...deriveMyAction(cur.turn.actions),
      } : null,
      river: cur.river.card ? {
        card: cur.river.card,
        pot: cur.river.endPot,
        notes: cur.river.notes,
        actions: cur.river.actions,
        ...deriveMyAction(cur.river.actions),
      } : null,
      result: cur.result,
      notes: cur.result.notes || '',
      playedAt: handTimeFrom(cur.playedTime, session?.date),
      createdAt: new Date().toISOString(),
    };

    await put('hands', record);
    navigate(`/session/${resolvedSessionId}`);
  }

  // When the hand was played — best effort: defaults to now, editable, or unknown.
  const timeRow = (
    <div className="time-row mb-12">
      <span className="text-muted text-sm">🕒 Played at</span>
      <input
        type="time"
        className="form-input time-input"
        value={hand.playedTime || ''}
        onChange={e => patchHand({ playedTime: e.target.value })}
      />
      <button className="btn btn-ghost btn-sm" onClick={() => patchHand({ playedTime: clockOf(new Date().toISOString()) })}>Now</button>
      <button
        className={'btn btn-ghost btn-sm' + (hand.playedTime ? '' : ' time-unknown-on')}
        onClick={() => patchHand({ playedTime: '' })}
      >
        Unknown
      </button>
    </div>
  );

  // ── All derived values (safe with null session via ?.) ──────────────────────
  const totalSeats = session?.totalSeats || 9;
  // Only seated players are dealt in (away / empty seats skipped). Editing an old
  // hand keeps the player count it was recorded with.
  const activeSeats = session ? activeSeatNums(session) : [];
  const dealtCount = isEditMode && editRecord
    ? (editRecord.dealt || totalSeats)
    : Math.min(9, Math.max(2, activeSeats.length || totalSeats));
  const tablePositions = TABLE_POSITIONS[dealtCount] || TABLE_POSITIONS[9];
  const mySeatNum = session?.mySeat || 1;
  const buttonSeat = buttonSeatAmong(activeSeats, mySeatNum, hand.myPosition);
  const currency = session?.currency || 'USD';
  const sym = chipSym(session);
  const mtt = isMtt(session);
  const bbTag = (x) => (mtt && bbCount(x, bb) != null ? ` (${bbCount(x, bb)} BB)` : '');
  const usedCards = allCards(hand);
  const progress = ((step + 1) / TOTAL) * 100;
  const showStickyBar = step >= 2;

  const preflopFolded = getFoldedPositions(hand.preflop.actions);
  const flopActivePositions = tablePositions.filter(p => !preflopFolded.has(p));
  const flopFolded = getFoldedPositions(hand.flop.actions);
  const turnActivePositions = flopActivePositions.filter(p => !flopFolded.has(p));
  const turnFolded = getFoldedPositions(hand.turn.actions);
  const riverActivePositions = turnActivePositions.filter(p => !turnFolded.has(p));

  const preflopStartPot = sb + bb + ante;
  const flopStartPot = hand.preflop.endPot || preflopStartPot;
  const turnStartPot = hand.flop.endPot || flopStartPot;
  const riverStartPot = hand.turn.endPot || turnStartPot;

  // ── Pots, side pots, rake (src/pots.js) ──────────────────────────────────────
  const STREETS = ['preflop', 'flop', 'turn', 'river'];
  const handForCalc = Object.fromEntries(STREETS.map(st => [st, { actions: hand[st].actions }]));
  const { pots, uncalled } = buildPots(handContributions(handForCalc, sb, bb, ante), foldedPositions(handForCalc), ante);
  const calledPot = pots.reduce((n, p) => n + p.amount, 0);
  const preflopOnly = endedPreflop(handForCalc);
  const rakeInfo = computeRake(calledPot, preflopOnly, session);
  const netPot = Math.max(0, calledPot - rakeInfo.total);
  const multiPot = pots.length > 1;
  const potLabel = (i) => (i === 0 ? 'Main pot' : `Side pot ${i}`);

  // What hero takes if hero wins every pot hero is in.
  const wonTake = heroTake(
    pots.map(p => ({ ...p, winners: p.eligible.includes(hand.myPosition) ? [hand.myPosition] : [] })),
    hand.myPosition, rakeInfo.total, uncalled,
  );
  // What hero should have pushed to them given the winners picked so far (#5).
  const suggestedTake = (() => {
    const res = hand.result;
    if (multiPot) {
      if (!res.potWinners) return null;
      return heroTake(pots.map((p, i) => ({ ...p, winners: res.potWinners[i] || [] })), hand.myPosition, rakeInfo.total, uncalled);
    }
    return res.outcome === 'won' ? wonTake : null;
  })();

  function togglePotWinner(i, pos) {
    const current = hand.result.potWinners || pots.map(() => []);
    const next = current.map((w, j) => (j !== i ? w : w.includes(pos) ? w.filter(x => x !== pos) : [...w, pos]));
    const take = heroTake(pots.map((p, j) => ({ ...p, winners: next[j] || [] })), hand.myPosition, rakeInfo.total, uncalled);
    patchHand({ result: {
      ...hand.result,
      potWinners: next,
      pots: pots.map((p, j) => ({ ...p, winners: next[j] || [] })),
      outcome: take > 0 ? 'won' : 'lost',
      winner: '',
      amount: String(take),
    } });
  }

  // #6: hero picked a different seat after recording — move hero's actions with them.
  function changePosition(pos) {
    const old = hand.myPosition;
    const hasActions = STREETS.some(st => hand[st].actions.length > 0);
    if (!old || old === pos || !hasActions) { patchHand({ myPosition: pos }); return; }
    const moved = relocateHero(Object.fromEntries(STREETS.map(st => [st, hand[st].actions])), old, pos, { totalSeats: dealtCount, sb, bb });
    const potThrough = (k) => {
      const partial = Object.fromEntries(STREETS.slice(0, k + 1).map(st => [st, { actions: moved[st] || [] }]));
      return Object.values(handContributions(partial, sb, bb, ante)).reduce((a, b) => a + b, 0);
    };
    setHand(prev => {
      const next = { ...prev, myPosition: pos, result: { outcome: '', amount: '', notes: prev.result.notes || '', winner: '' } };
      STREETS.forEach((st, k) => {
        const acts = moved[st] || [];
        next[st] = { ...prev[st], actions: acts, endPot: acts.length ? potThrough(k) : 0 };
      });
      return next;
    });
    setRelocatedNote(`Your actions moved from ${old} to ${pos}. Check each street — anything that no longer fits was removed, and the result needs picking again.`);
  }

  const allInThrough = (k) => [...new Set(STREETS.slice(0, k + 1).flatMap(st => hand[st].actions.filter(a => a.allIn).map(a => a.pos)))];

  const finalRemaining = (() => {
    const riverFoldedSet = getFoldedPositions(hand.river.actions);
    if (hand.river.actions.length > 0) return riverActivePositions.filter(p => !riverFoldedSet.has(p));
    if (hand.turn.actions.length > 0) return turnActivePositions.filter(p => !turnFolded.has(p));
    if (hand.flop.actions.length > 0) return flopActivePositions.filter(p => !flopFolded.has(p));
    return flopActivePositions;
  })();

  const rakeConfigured = session?.rake != null;

  // A street's actions changed: store them, then re-check every later street
  // against who is still in (a player who now folds loses their later actions).
  function setStreetActions(street, actions) { applyStreets(street, actions, { sb, bb, ante }); }

  // street === null: no street changed, only the blinds (re-check everything).
  function deriveHand(prev, street, actions, b) {
    derivedBlindsRef.current = { sb: b.sb, bb: b.bb, ante: b.ante };
    const streets = Object.fromEntries(STREETS.map(st => [st, st === street ? actions : prev[st].actions]));
    const checked = revalidateStreets(streets, prev.myPosition, { totalSeats: dealtCount, sb: b.sb, bb: b.bb });
    const next = { ...prev };
    const changedIdx = street ? STREETS.indexOf(street) : -1;
    STREETS.forEach((st, k) => {
      const acts = changedIdx >= k ? streets[st] : (checked[st] || []);
      const partial = Object.fromEntries(STREETS.slice(0, k + 1).map(x => [x, { actions: x === st ? acts : next[x].actions }]));
      const cumulative = Object.values(handContributions(partial, b.sb, b.bb, b.ante)).reduce((a, c) => a + c, 0);
      next[st] = { ...prev[st], actions: acts, endPot: acts.length ? cumulative : 0 };
    });
    return next;
  }

  function applyStreets(street, actions, b) {
    setHand(prev => deriveHand(prev, street, actions, b));
  }

  const boardLock = {
    flop: hand.flop.cards.every(Boolean) ? '' : 'Pick the 3 flop cards first',
    turn: hand.turn.card ? '' : 'Pick the turn card first',
    river: hand.river.card ? '' : 'Pick the river card first',
  };

  // A street finished (Done / auto-close / hero folded). Decide the next step
  // from the actions just produced — React state may not have caught up yet.
  const STREET_STEP = { preflop: 2, flop: 3, turn: 4, river: 5 };
  function afterStreet(street, streetActions, livePositions) {
    const heroFoldedNow = (streetActions || []).some(a => a.pos === hand.myPosition && a.action === 'fold');
    if (heroFoldedNow) {
      setHand(prev => ({ ...prev, result: { ...prev.result, outcome: 'folded', amount: '', winner: '' } }));
      setStep(6);
      return;
    }
    const folded = getFoldedPositions(streetActions);
    const remaining = livePositions.filter(p => !folded.has(p));
    if (street === 'river' || remaining.length <= 1) setStep(6);
    else setStep(STREET_STEP[street] + 1);
  }

  const heroFolded = ['preflop', 'flop', 'turn', 'river']
    .some(st => (hand[st]?.actions || []).some(a => a.pos === hand.myPosition && a.action === 'fold'));

  function canAdvance() {
    if (step === 0) return !!hand.myPosition && (!mtt || bb > 0 || (isEditMode && !(Number(editRecord?.blinds?.bb) > 0)));
    if (step === 1) return !!(hand.holeCards[0] && hand.holeCards[1]);
    if (step === 6) return !!hand.result.outcome;
    return true;
  }

  // Auto-fill result when arriving at step 6 — MUST be before early return
  useEffect(() => {
    if (step !== 6 || !session || hand.result.outcome) return;
    if (heroFolded) {
      patchHand({ result: { ...hand.result, outcome: 'folded', amount: '', winner: '' } });
      return;
    }
    if (finalRemaining.length <= 1 && finalRemaining.includes(hand.myPosition)) {
      patchHand({ result: { ...hand.result, outcome: 'won', amount: String(wonTake), winner: hand.myPosition } });
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Early return after all hooks ─────────────────────────────────────────────
  if (!session) return <div className="screen"><div className="text-muted">Loading…</div></div>;

  return (
    <div className="screen" style={{ paddingBottom: 'calc(var(--nav-height) + 80px)', paddingTop: showStickyBar ? '0' : undefined }}>
      <div className="screen-header">
        <button
          className="back-btn"
          onClick={() => {
            if (step === 0) {
              if (isEditMode) navigate(`/hand/${handId}`);
              else navigate(`/session/${resolvedSessionId}`);
            } else {
              setStep(s => s - 1);
            }
          }}
        >
          {step === 0 ? '← Cancel' : '← Back'}
        </button>
        <h1>{isEditMode ? 'Edit Hand' : 'Record Hand'}</h1>
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="step-label">Step {step + 1} of {TOTAL} — {STEPS[step]}</div>

      {/* Sticky setup bar (steps 2+) */}
      {showStickyBar && (
        <div className="sticky-setup-bar">
          <PositionBadge position={hand.myPosition} />
          <div className="sticky-hole-cards">
            <MiniCard card={hand.holeCards[0]} />
            <MiniCard card={hand.holeCards[1]} />
          </div>
          <button className="btn-ghost btn btn-sm" onClick={() => setStep(0)}>
            Edit
          </button>
        </div>
      )}

      {/* Step 0: My Position */}
      {step === 0 && (
        <div>
          {mtt && (
            <div className="form-group">
              <label className="form-label">Blinds <span className="text-muted text-xs">(盲注記喺呢手牌)</span></label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['sb', 'SB'], ['bb', 'BB'], ['ante', 'BB ante']].map(([k, label]) => (
                  <div key={k} style={{ flex: 1 }}>
                    <div className="text-muted text-xs mb-4">{label}</div>
                    <input
                      type="text"
                      className="form-input"
                      inputMode="numeric"
                      placeholder="0"
                      value={blindStr[k]}
                      onChange={e => setBlind(k, e.target.value)}
                      onBlur={() => commitBlinds()}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          {timeRow}
          <div className="pill-group mb-12">
            <button className={'pill' + (posMode === 'position' ? ' selected' : '')} onClick={() => choosePosMode('position')}>Position</button>
            <button className={'pill' + (posMode === 'button' ? ' selected' : '')} onClick={() => choosePosMode('button')}>Button seat</button>
          </div>

          {posMode === 'position' ? (
            <div className="form-group">
              <label className="form-label">My Position</label>
              <div className="quick-pos-grid">
                {tablePositions.map(pos => (
                  <button
                    key={pos}
                    className={'quick-pos-btn' + (hand.myPosition === pos ? ' selected' : '')}
                    onClick={() => changePosition(pos)}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Which seat has the dealer button? <span className="text-muted text-xs">(you're in seat {mySeatNum})</span></label>
              <div className="seat-grid">
                {Array.from({ length: totalSeats }, (_, i) => i + 1).map(n => {
                  const seat = (session.seats || []).find(x => x.seatNum === n) || {};
                  const out = n !== mySeatNum && SEAT_OUT.includes(seat.status);
                  const who = n === mySeatNum ? 'You' : (seat.name || seat.code || '');
                  return (
                    <button
                      key={n}
                      disabled={out}
                      className={'seat-btn seat-btn-labelled' + (out ? ' seat-out' : n === buttonSeat ? ' is-btn' : n === mySeatNum ? ' is-me' : '')}
                      onClick={() => changePosition(positionAmong(activeSeats, mySeatNum, n))}
                    >
                      <span>{n}</span>
                      <span className="seat-sub">{out ? (seat.status === 'away' ? 'Away' : 'Empty') : who}</span>
                      {!out && buttonSeat && (
                        <span className="seat-sub">{positionAmong(activeSeats, n, buttonSeat)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {!isEditMode && activeSeats.length < totalSeats && (
            <div className="text-muted text-xs mb-12">
              {dealtCount} players dealt in — seat {Array.from({ length: totalSeats }, (_, i) => i + 1).filter(n => !activeSeats.includes(n)).join(', ')} away or empty
            </div>
          )}

          {relocatedNote && <div className="relocated-note text-sm mb-12">{relocatedNote}</div>}
          {hand.myPosition && (
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="text-muted text-sm mb-8">My Position</div>
              <PositionBadge position={hand.myPosition} />
            </div>
          )}
        </div>
      )}

      {/* Step 1: Hole Cards */}
      {step === 1 && (
        <div>
          <div className="form-group">
            <label className="form-label">Hole Cards</label>
            <InlineCardPicker
              cards={hand.holeCards}
              onChange={cards => patchHand({ holeCards: cards })}
              usedCards={usedCards.filter(c => !hand.holeCards.includes(c))}
            />
          </div>
        </div>
      )}

      {/* Step 2: Pre-flop */}
      {step === 2 && (
        <div>
          <div className="street-banner">PRE-FLOP</div>
          <PositionSequencer
            totalSeats={dealtCount}
            street="preflop"
            myPosition={hand.myPosition}
            activePositions={tablePositions}
            actions={hand.preflop.actions}
            onChange={actions => setStreetActions('preflop', actions)}
            startPot={preflopStartPot}
            bb={bb}
            sb={sb}
            currency={currency}
            sym={sym}
            onComplete={acts => afterStreet('preflop', acts, tablePositions)}
            prevPreflopActions={prevPreflopActions}
            onBack={() => setStep(1)}
            backLabel="Back to cards"
          />

          {mtt && (
            <details className="form-group" style={{ marginTop: 12 }}>
              <summary className="form-label" style={{ cursor: 'pointer' }}>後手 Stacks（選填）</summary>
              {stackRows(hand).map(pos => (
                <div key={pos} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <span style={{ width: 64 }}>{pos}{pos === hand.myPosition && <span className="text-muted text-xs"> You</span>}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="form-input"
                    style={{ flex: 1 }}
                    placeholder="chips"
                    aria-label={`${pos} stack`}
                    value={hand.stacks?.[pos] ?? ''}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '');
                      setHand(prev => {
                        const st = { ...(prev.stacks || {}) };
                        if (v === '') delete st[pos]; else st[pos] = Number(v);
                        return { ...prev, stacks: st };
                      });
                    }}
                  />
                  <span className="text-muted text-xs" style={{ width: 70 }}>
                    {hand.stacks?.[pos] > 0 && bb > 0 ? `${bbCount(hand.stacks[pos], bb)} BB` : ''}
                  </span>
                </div>
              ))}
            </details>
          )}

          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 3-bet pot"
              value={hand.preflop.notes}
              onChange={e => patchStreet('preflop', { notes: e.target.value })}
            />
          </div>

        </div>
      )}

      {/* Step 3: Flop */}
      {step === 3 && (
        <div>
          <div className="street-banner">FLOP <small>{hand.flop.cards.filter(Boolean).map(formatCard).join(' ')}</small></div>
          <div className="form-group">
            <label className="form-label">Flop Cards</label>
            <InlineCardPicker
              cards={hand.flop.cards}
              onChange={cards => patchStreet('flop', { cards })}
              usedCards={usedCards.filter(c => !hand.flop.cards.includes(c))}
            />
          </div>

          <PositionSequencer
            totalSeats={dealtCount}
            street="flop"
            myPosition={hand.myPosition}
            activePositions={flopActivePositions}
            allInBefore={allInThrough(0)}
            actions={hand.flop.actions}
            onChange={actions => setStreetActions('flop', actions)}
            startPot={flopStartPot}
            bb={bb}
            sb={sb}
            currency={currency}
            sym={sym}
            onComplete={acts => afterStreet('flop', acts, flopActivePositions)}
            locked={boardLock.flop}
            onBack={() => setStep(2)}
            backLabel="Back to pre-flop"
            cbet={cbetHint({ preflop: hand.preflop.actions }, 'flop')}
          />

          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="Flop notes"
              value={hand.flop.notes}
              onChange={e => patchStreet('flop', { notes: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* Step 4: Turn */}
      {step === 4 && (
        <div>
          <div className="street-banner">TURN <small>{hand.turn.card ? formatCard(hand.turn.card) : ''}</small></div>
          <div className="form-group">
            <label className="form-label">Turn Card</label>
            <InlineCardPicker
              cards={[hand.turn.card]}
              onChange={([c]) => patchStreet('turn', { card: c })}
              usedCards={usedCards.filter(c => c !== hand.turn.card)}
            />
          </div>

          <PositionSequencer
            totalSeats={dealtCount}
            street="turn"
            myPosition={hand.myPosition}
            activePositions={turnActivePositions}
            allInBefore={allInThrough(1)}
            actions={hand.turn.actions}
            onChange={actions => setStreetActions('turn', actions)}
            startPot={turnStartPot}
            bb={bb}
            sb={sb}
            currency={currency}
            sym={sym}
            onComplete={acts => afterStreet('turn', acts, turnActivePositions)}
            locked={boardLock.turn}
            onBack={() => setStep(3)}
            backLabel="Back to flop"
            cbet={cbetHint({ preflop: hand.preflop.actions, flop: hand.flop.actions }, 'turn')}
          />

          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="Turn notes"
              value={hand.turn.notes}
              onChange={e => patchStreet('turn', { notes: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* Step 5: River */}
      {step === 5 && (
        <div>
          <div className="street-banner">RIVER <small>{hand.river.card ? formatCard(hand.river.card) : ''}</small></div>
          <div className="form-group">
            <label className="form-label">River Card</label>
            <InlineCardPicker
              cards={[hand.river.card]}
              onChange={([c]) => patchStreet('river', { card: c })}
              usedCards={usedCards.filter(c => c !== hand.river.card)}
            />
          </div>

          <PositionSequencer
            totalSeats={dealtCount}
            street="river"
            myPosition={hand.myPosition}
            activePositions={riverActivePositions}
            allInBefore={allInThrough(2)}
            actions={hand.river.actions}
            onChange={actions => setStreetActions('river', actions)}
            startPot={riverStartPot}
            bb={bb}
            sb={sb}
            currency={currency}
            sym={sym}
            onComplete={acts => afterStreet('river', acts, riverActivePositions)}
            locked={boardLock.river}
            onBack={() => setStep(4)}
            backLabel="Back to turn"
          />

          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="River notes"
              value={hand.river.notes}
              onChange={e => patchStreet('river', { notes: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* Step 6: Result */}
      {step === 6 && (
        <div>
          {timeRow}
          {mtt && bb > 0 && <div className="text-muted text-xs mb-8">{levelLabel(blindsToSave())}</div>}
          {/* Pot summary */}
          <div className="result-pot-card">
            <div className="result-pot-row">
              <span>Final pot</span>
              <strong>{sym}{calledPot.toLocaleString()}{bbTag(calledPot)}</strong>
            </div>
            {multiPot && pots.map((p, i) => (
              <div key={i} className="result-pot-row text-muted text-sm">
                <span>{potLabel(i)} · {p.eligible.map(x => (x === hand.myPosition ? 'Me' : x)).join(', ')}</span>
                <span>{sym}{p.amount.toLocaleString()}</span>
              </div>
            ))}
            {uncalled && (
              <div className="result-pot-row text-muted text-sm">
                <span>Uncalled, back to {uncalled.pos === hand.myPosition ? 'me' : uncalled.pos}</span>
                <span>{sym}{uncalled.amount.toLocaleString()}</span>
              </div>
            )}
            {rakeInfo.rake > 0 && (
              <div className="result-pot-row text-muted text-sm">
                <span>Rake</span>
                <span>−{sym}{rakeInfo.rake.toLocaleString()}</span>
              </div>
            )}
            {rakeInfo.jackpot > 0 && (
              <div className="result-pot-row text-muted text-sm">
                <span>Jackpot</span>
                <span>−{sym}{rakeInfo.jackpot.toLocaleString()}</span>
              </div>
            )}
            {preflopOnly && session?.rake != null && (
              <div className="result-pot-row text-muted text-xs">
                <span>Ended pre-flop — no rake</span><span />
              </div>
            )}
            <div className="result-pot-row result-pot-net">
              <span>Net pot</span>
              <strong>{sym}{netPot.toLocaleString()}{bbTag(netPot)}</strong>
            </div>
          </div>

          {/* Rake not configured — inline prompt */}
          {!rakeConfigured && !mtt && (
            <div className="card mb-12" style={{ borderColor: '#f4c43066' }}>
              <div className="text-muted text-sm mb-8">Commission / Rake not set for this session</div>
              <div className="pill-group mb-8">
                <button className={'pill' + (pendingRakeType === 'percent' ? ' selected' : '')} onClick={() => setPendingRakeType('percent')}>% of pot</button>
                <button className={'pill' + (pendingRakeType === 'flat' ? ' selected' : '')} onClick={() => setPendingRakeType('flat')}>Flat</button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  className="form-input"
                  placeholder={pendingRakeType === 'percent' ? 'e.g. 5 (%)' : 'e.g. 500 flat'}
                  value={pendingRake}
                  onChange={e => setPendingRake(e.target.value)}
                  inputMode="numeric"
                  style={{ flex: 1 }}
                />
                {pendingRakeType === 'percent' && (
                  <input
                    type="number"
                    className="form-input"
                    placeholder="Max"
                    value={pendingRakeMax}
                    onChange={e => setPendingRakeMax(e.target.value)}
                    inputMode="numeric"
                    style={{ width: 90 }}
                  />
                )}
                <button className="btn btn-secondary btn-sm" onClick={saveRakeToSession} disabled={!pendingRake}>
                  Apply
                </button>
              </div>
              <input
                type="number"
                className="form-input mt-8"
                placeholder="Jackpot per hand (optional)"
                value={pendingJackpot}
                onChange={e => setPendingJackpot(e.target.value)}
                inputMode="numeric"
              />
            </div>
          )}

          {/* Who won? */}
          {heroFolded && (
            <div className="result-auto-won result-folded-banner">You folded</div>
          )}
          {!heroFolded && multiPot ? (
            <div className="form-group">
              <label className="form-label">Who won each pot? <span className="text-muted text-xs">(tap two to split)</span></label>
              {pots.map((p, i) => (
                <div key={i} className="pot-winner-row">
                  <div className="text-sm mb-8">{potLabel(i)} · {sym}{p.amount.toLocaleString()}</div>
                  <div className="action-row" style={{ flexWrap: 'wrap' }}>
                    {p.eligible.map(pos => {
                      const sel = (hand.result.potWinners?.[i] || []).includes(pos);
                      return (
                        <button
                          key={pos}
                          className={'action-btn' + (sel ? ' selected' + (pos !== hand.myPosition ? ' fold' : '') : '')}
                          onClick={() => togglePotWinner(i, pos)}
                        >
                          {pos === hand.myPosition ? 'Me' : pos}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : !heroFolded && finalRemaining.length <= 1 && finalRemaining.includes(hand.myPosition) ? (
            <div className="result-auto-won">You win — everyone else folded</div>
          ) : (
            <div className="form-group">
              <label className="form-label">{heroFolded ? 'Who won? (optional)' : 'Who won?'}</label>
              <div className="action-row" style={{ flexWrap: 'wrap' }}>
                {finalRemaining.map(pos => (
                  <button
                    key={pos}
                    className={
                      'action-btn' +
                      (hand.result.winner === pos
                        ? ' selected' + (pos !== hand.myPosition ? ' fold' : '')
                        : '')
                    }
                    onClick={() => {
                      if (heroFolded) {
                        patchHand({ result: { ...hand.result, outcome: 'folded', winner: pos, amount: '' } });
                        return;
                      }
                      const iWon = pos === hand.myPosition;
                      patchHand({ result: {
                        ...hand.result,
                        outcome: iWon ? 'won' : 'lost',
                        winner: pos,
                        amount: iWon ? String(wonTake) : hand.result.amount || '',
                      }});
                    }}
                  >
                    {pos === hand.myPosition ? 'Me' : pos}
                  </button>
                ))}
                {!heroFolded && (
                  <button
                    className={'action-btn' + (hand.result.outcome === 'split' ? ' selected' : '')}
                    onClick={() => patchHand({ result: { ...hand.result, outcome: 'split', winner: '' } })}
                  >
                    Split
                  </button>
                )}
                {!heroFolded && (
                  <button
                    className={'action-btn' + (hand.result.outcome === 'folded' ? ' selected fold' : '')}
                    onClick={() => patchHand({ result: { ...hand.result, outcome: 'folded', winner: '', amount: '' } })}
                  >
                    I folded
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Amount */}
          {hand.result.outcome && (
            <div className="form-group">
              {hand.result.outcome !== 'folded' && (<>
              <label className="form-label">
                {hand.result.outcome === 'won' ? 'Amount won' :
                 hand.result.outcome === 'lost' ? 'Amount lost' : 'Your share of the pot'}
              </label>
              <input
                type="number"
                className="form-input"
                placeholder="0"
                value={hand.result.amount}
                onChange={e => patchHand({ result: { ...hand.result, amount: e.target.value } })}
                inputMode="numeric"
              />
              </>)}
              {suggestedTake != null && Number(hand.result.amount) !== suggestedTake && (
                <div className="recalc-hint text-xs mt-4">
                  <span>Pot is now {sym}{suggestedTake.toLocaleString()} for you</span>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => patchHand({ result: { ...hand.result, amount: String(suggestedTake) } })}
                  >
                    Recalculate
                  </button>
                </div>
              )}
              {hand.result.outcome === 'won' && rakeInfo.total > 0 && Number(hand.result.amount) === suggestedTake && (
                <div className="text-muted text-xs mt-4">
                  Pot {sym}{calledPot.toLocaleString()} − rake/jackpot {sym}{rakeInfo.total.toLocaleString()} = {sym}{netPot.toLocaleString()}
                </div>
              )}
              {hand.result.outcome && (() => {
                const handForNet = {
                  myPosition: hand.myPosition,
                  quick: false,
                  preflop: { actions: hand.preflop.actions },
                  flop: { actions: hand.flop.actions },
                  turn: { actions: hand.turn.actions },
                  river: { actions: hand.river.actions },
                  result: hand.result,
                };
                const invested = heroInvested(handForNet, sb, bb, ante);
                const net = handNet(handForNet, { sb, bb, ante });
                return (
                  <div className={'text-xs mt-4 ' + (net >= 0 ? 'result-won' : 'result-lost')}>
                    Net this hand: {net >= 0 ? '+' : '−'}{sym}{Math.abs(net).toLocaleString()}{bbTag(Math.abs(net))}
                    <span className="text-muted"> · you put in {sym}{invested.toLocaleString()}</span>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="Any notes about this hand"
              value={hand.result.notes || ''}
              onChange={e => patchHand({ result: { ...hand.result, notes: e.target.value } })}
            />
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="sticky-bottom">
        <div className="row gap-8">
          {step < 6 ? (
            <button
              className="btn btn-primary flex-1"
              onClick={() => { if (step === 0) commitBlinds(); setStep(s => s + 1); }}
              disabled={!canAdvance()}
              style={{ opacity: canAdvance() ? 1 : 0.5 }}
            >
              Next →
            </button>
          ) : (
            <button
              className="btn btn-primary flex-1"
              onClick={saveHand}
              disabled={!canAdvance()}
              style={{ opacity: canAdvance() ? 1 : 0.5 }}
            >
              Save Hand
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
