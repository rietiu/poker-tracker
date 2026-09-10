import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { get, getHandsBySession, put, del } from '../db';
import { uuid, parseBB, parseSB, TABLE_POSITIONS, formatCard, isRedCard, handNet, heroInvested } from '../utils';
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
    preflop: { actions: [], notes: '', endPot: 0 },
    flop: { cards: [null, null, null], actions: [], notes: '', endPot: 0 },
    turn: { card: null, actions: [], notes: '', endPot: 0 },
    river: { card: null, actions: [], notes: '', endPot: 0 },
    result: { outcome: '', amount: '', notes: '', winner: '' },
  });

  const [bb, setBb] = useState(2);
  const [sb, setSb] = useState(1);
  const [draftId, setDraftId] = useState(null);
  const [editRecord, setEditRecord] = useState(null); // original record when editing
  const [pendingRake, setPendingRake] = useState('');
  const [pendingRakeType, setPendingRakeType] = useState('percent');
  const [pendingRakeMax, setPendingRakeMax] = useState('');

  useEffect(() => {
    async function init() {
      let sid = routeSessionId;

      if (isEditMode) {
        // ── Edit a completed hand ─────────────────────────────────────────────
        const record = await get('hands', handId);
        if (!record) return;
        sid = record.sessionId;
        setResolvedSessionId(sid);
        setEditRecord(record);
        setHand({
          myPosition: record.myPosition || '',
          holeCards: record.holeCards || [null, null],
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
        });
        setStep(6);
      } else if (isResumeMode) {
        // ── Resume an existing draft ──────────────────────────────────────────
        const record = await get('hands', resumeId);
        if (record?.incomplete) {
          sid = record.sessionId;
          setResolvedSessionId(sid);
          setDraftId(resumeId); // reuse the same draft ID so auto-save overwrites it
          if (record.draftState?.hand) {
            // Merge with default structure to guard against older draft formats
            const saved = record.draftState.hand;
            setHand({
              myPosition: saved.myPosition || '',
              holeCards: saved.holeCards || [null, null],
              preflop: { actions: [], notes: '', endPot: 0, ...(saved.preflop || {}) },
              flop:    { cards: [null, null, null], actions: [], notes: '', endPot: 0, ...(saved.flop || {}) },
              turn:    { card: null, actions: [], notes: '', endPot: 0, ...(saved.turn || {}) },
              river:   { card: null, actions: [], notes: '', endPot: 0, ...(saved.river || {}) },
              result:  { outcome: '', amount: '', notes: '', winner: '', ...(saved.result || {}) },
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

      const s = await get('sessions', sid);
      setSession(s);
      if (s) { setBb(parseBB(s.game)); setSb(parseSB(s.game)); }
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
        draftState: { step, hand },
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [hand, step, draftId, resolvedSessionId, isEditMode]);

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
    };
    await put('sessions', updated);
    setSession(updated);
  }

  async function saveHand() {
    const sid = resolvedSessionId;

    if (isEditMode && editRecord) {
      // Edit mode is only for completed hands — update in place
      const updated = {
        ...editRecord,
        myPosition: hand.myPosition,
        holeCards: hand.holeCards,
        preflop: {
          ...editRecord.preflop,
          pot: hand.preflop.endPot,
          notes: hand.preflop.notes,
          actions: hand.preflop.actions,
          ...deriveMyAction(hand.preflop.actions),
        },
        flop: hand.flop.cards.some(Boolean) ? {
          cards: hand.flop.cards,
          pot: hand.flop.endPot,
          notes: hand.flop.notes,
          actions: hand.flop.actions,
          ...deriveMyAction(hand.flop.actions),
        } : null,
        turn: hand.turn.card ? {
          card: hand.turn.card,
          pot: hand.turn.endPot,
          notes: hand.turn.notes,
          actions: hand.turn.actions,
          ...deriveMyAction(hand.turn.actions),
        } : null,
        river: hand.river.card ? {
          card: hand.river.card,
          pot: hand.river.endPot,
          notes: hand.river.notes,
          actions: hand.river.actions,
          ...deriveMyAction(hand.river.actions),
        } : null,
        result: hand.result,
        notes: hand.result.notes || '',
        updatedAt: new Date().toISOString(),
      };
      await put('hands', updated);
      navigate(`/hand/${handId}`);
      return;
    }

    // Create / resume mode — complete the draft and save as a proper hand record
    if (draftId) await del('hands', draftId);
    const prevHands = await getHandsBySession(sid);
    const handNum = prevHands.filter(h => !h.incomplete).length + 1;

    const record = {
      id: uuid(),
      sessionId: sid,
      handNum,
      myPosition: hand.myPosition,
      holeCards: hand.holeCards,
      preflop: {
        pot: hand.preflop.endPot,
        notes: hand.preflop.notes,
        actions: hand.preflop.actions,
        ...deriveMyAction(hand.preflop.actions),
      },
      flop: hand.flop.cards.some(Boolean) ? {
        cards: hand.flop.cards,
        pot: hand.flop.endPot,
        notes: hand.flop.notes,
        actions: hand.flop.actions,
        ...deriveMyAction(hand.flop.actions),
      } : null,
      turn: hand.turn.card ? {
        card: hand.turn.card,
        pot: hand.turn.endPot,
        notes: hand.turn.notes,
        actions: hand.turn.actions,
        ...deriveMyAction(hand.turn.actions),
      } : null,
      river: hand.river.card ? {
        card: hand.river.card,
        pot: hand.river.endPot,
        notes: hand.river.notes,
        actions: hand.river.actions,
        ...deriveMyAction(hand.river.actions),
      } : null,
      result: hand.result,
      notes: hand.result.notes || '',
      createdAt: new Date().toISOString(),
    };

    await put('hands', record);
    navigate(`/session/${resolvedSessionId}`);
  }

  // ── All derived values (safe with null session via ?.) ──────────────────────
  const CURRENCY_SYMBOLS = { USD: '$', PHP: '₱', EUR: '€', GBP: '£' };
  const totalSeats = session?.totalSeats || 9;
  const tablePositions = TABLE_POSITIONS[totalSeats] || TABLE_POSITIONS[9];
  const currency = session?.currency || 'USD';
  const sym = CURRENCY_SYMBOLS[currency] || '$';
  const usedCards = allCards(hand);
  const progress = ((step + 1) / TOTAL) * 100;
  const showStickyBar = step >= 2;

  const preflopFolded = getFoldedPositions(hand.preflop.actions);
  const flopActivePositions = tablePositions.filter(p => !preflopFolded.has(p));
  const flopFolded = getFoldedPositions(hand.flop.actions);
  const turnActivePositions = flopActivePositions.filter(p => !flopFolded.has(p));
  const turnFolded = getFoldedPositions(hand.turn.actions);
  const riverActivePositions = turnActivePositions.filter(p => !turnFolded.has(p));

  const preflopStartPot = sb + bb;
  const flopStartPot = hand.preflop.endPot || preflopStartPot;
  const turnStartPot = hand.flop.endPot || flopStartPot;
  const riverStartPot = hand.turn.endPot || turnStartPot;

  const totalHandPot = (() => {
    if (hand.river.actions.length > 0 && hand.river.endPot > 0) return hand.river.endPot;
    if (hand.turn.actions.length > 0 && hand.turn.endPot > 0) return hand.turn.endPot;
    if (hand.flop.actions.length > 0 && hand.flop.endPot > 0) return hand.flop.endPot;
    return hand.preflop.endPot > 0 ? hand.preflop.endPot : preflopStartPot;
  })();

  const effectiveRake = (() => {
    const r = session?.rake ?? null;
    if (r === null) return 0;
    if ((session?.rakeType || 'flat') === 'percent') {
      const amt = Math.round(totalHandPot * r / 100);
      return (session?.rakeMax > 0) ? Math.min(amt, session.rakeMax) : amt;
    }
    return r;
  })();

  const netPot = Math.max(0, totalHandPot - effectiveRake);

  const finalRemaining = (() => {
    const riverFoldedSet = getFoldedPositions(hand.river.actions);
    if (hand.river.actions.length > 0) return riverActivePositions.filter(p => !riverFoldedSet.has(p));
    if (hand.turn.actions.length > 0) return turnActivePositions.filter(p => !turnFolded.has(p));
    if (hand.flop.actions.length > 0) return flopActivePositions.filter(p => !flopFolded.has(p));
    return flopActivePositions;
  })();

  const rakeConfigured = session?.rake != null;

  function canAdvance() {
    if (step === 0) return !!hand.myPosition;
    if (step === 1) return !!(hand.holeCards[0] && hand.holeCards[1]);
    if (step === 6) return !!hand.result.outcome;
    return true;
  }

  // Auto-fill result when arriving at step 6 — MUST be before early return
  useEffect(() => {
    if (step !== 6 || !session || hand.result.outcome) return;
    if (finalRemaining.length <= 1 && finalRemaining.includes(hand.myPosition)) {
      patchHand({ result: { ...hand.result, outcome: 'won', amount: String(netPot), winner: hand.myPosition } });
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
          ← Cancel
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
          <div className="form-group">
            <label className="form-label">My Position</label>
            <div className="quick-pos-grid">
              {tablePositions.map(pos => (
                <button
                  key={pos}
                  className={'quick-pos-btn' + (hand.myPosition === pos ? ' selected' : '')}
                  onClick={() => patchHand({ myPosition: pos })}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

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
          <PositionSequencer
            totalSeats={totalSeats}
            street="preflop"
            myPosition={hand.myPosition}
            activePositions={tablePositions}
            actions={hand.preflop.actions}
            onChange={(actions, endPot) => patchStreet('preflop', { actions, endPot })}
            startPot={preflopStartPot}
            bb={bb}
            sb={sb}
            currency={currency}
            onComplete={() => flopActivePositions.length <= 1 ? setStep(6) : setStep(3)}
          />

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
          <div className="form-group">
            <label className="form-label">Flop Cards</label>
            <InlineCardPicker
              cards={hand.flop.cards}
              onChange={cards => patchStreet('flop', { cards })}
              usedCards={usedCards.filter(c => !hand.flop.cards.includes(c))}
            />
          </div>

          <PositionSequencer
            totalSeats={totalSeats}
            street="flop"
            myPosition={hand.myPosition}
            activePositions={flopActivePositions}
            actions={hand.flop.actions}
            onChange={(actions, endPot) => patchStreet('flop', { actions, endPot })}
            startPot={flopStartPot}
            bb={bb}
            sb={sb}
            currency={currency}
            onComplete={() => turnActivePositions.length <= 1 ? setStep(6) : setStep(4)}
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
          <div className="form-group">
            <label className="form-label">Turn Card</label>
            <InlineCardPicker
              cards={[hand.turn.card]}
              onChange={([c]) => patchStreet('turn', { card: c })}
              usedCards={usedCards.filter(c => c !== hand.turn.card)}
            />
          </div>

          <PositionSequencer
            totalSeats={totalSeats}
            street="turn"
            myPosition={hand.myPosition}
            activePositions={turnActivePositions}
            actions={hand.turn.actions}
            onChange={(actions, endPot) => patchStreet('turn', { actions, endPot })}
            startPot={turnStartPot}
            bb={bb}
            sb={sb}
            currency={currency}
            onComplete={() => riverActivePositions.length <= 1 ? setStep(6) : setStep(5)}
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
          <div className="form-group">
            <label className="form-label">River Card</label>
            <InlineCardPicker
              cards={[hand.river.card]}
              onChange={([c]) => patchStreet('river', { card: c })}
              usedCards={usedCards.filter(c => c !== hand.river.card)}
            />
          </div>

          <PositionSequencer
            totalSeats={totalSeats}
            street="river"
            myPosition={hand.myPosition}
            activePositions={riverActivePositions}
            actions={hand.river.actions}
            onChange={(actions, endPot) => patchStreet('river', { actions, endPot })}
            startPot={riverStartPot}
            bb={bb}
            sb={sb}
            currency={currency}
            onComplete={() => setStep(6)}
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
          {/* Pot summary */}
          <div className="result-pot-card">
            <div className="result-pot-row">
              <span>Final pot</span>
              <strong>{sym}{totalHandPot.toLocaleString()}</strong>
            </div>
            {effectiveRake > 0 && (
              <div className="result-pot-row text-muted text-sm">
                <span>Rake</span>
                <span>−{sym}{effectiveRake.toLocaleString()}</span>
              </div>
            )}
            <div className="result-pot-row result-pot-net">
              <span>Net pot</span>
              <strong>{sym}{netPot.toLocaleString()}</strong>
            </div>
          </div>

          {/* Rake not configured — inline prompt */}
          {!rakeConfigured && (
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
            </div>
          )}

          {/* Who won? */}
          {finalRemaining.length <= 1 && finalRemaining.includes(hand.myPosition) ? (
            <div className="result-auto-won">You win — everyone else folded</div>
          ) : (
            <div className="form-group">
              <label className="form-label">Who won?</label>
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
                      const iWon = pos === hand.myPosition;
                      patchHand({ result: {
                        ...hand.result,
                        outcome: iWon ? 'won' : 'lost',
                        winner: pos,
                        amount: iWon ? String(netPot) : hand.result.amount || '',
                      }});
                    }}
                  >
                    {pos === hand.myPosition ? 'Me' : pos}
                  </button>
                ))}
                <button
                  className={'action-btn' + (hand.result.outcome === 'split' ? ' selected' : '')}
                  onClick={() => patchHand({ result: { ...hand.result, outcome: 'split', winner: '' } })}
                >
                  Split
                </button>
              </div>
            </div>
          )}

          {/* Amount */}
          {hand.result.outcome && (
            <div className="form-group">
              <label className="form-label">
                {hand.result.outcome === 'won' ? 'Amount won' :
                 hand.result.outcome === 'lost' ? 'Amount lost' : 'Amount'}
              </label>
              <input
                type="number"
                className="form-input"
                placeholder="0"
                value={hand.result.amount}
                onChange={e => patchHand({ result: { ...hand.result, amount: e.target.value } })}
                inputMode="numeric"
              />
              {hand.result.outcome === 'won' && effectiveRake > 0 && (
                <div className="text-muted text-xs mt-4">
                  Pot {sym}{totalHandPot.toLocaleString()} − rake {sym}{effectiveRake.toLocaleString()} = {sym}{netPot.toLocaleString()}
                </div>
              )}
              {hand.result.outcome && hand.result.outcome !== 'folded' && (() => {
                const handForNet = {
                  myPosition: hand.myPosition,
                  quick: false,
                  preflop: { actions: hand.preflop.actions },
                  flop: { actions: hand.flop.actions },
                  turn: { actions: hand.turn.actions },
                  river: { actions: hand.river.actions },
                  result: hand.result,
                };
                const invested = heroInvested(handForNet, sb, bb);
                const net = handNet(handForNet, { sb, bb });
                return (
                  <div className={'text-xs mt-4 ' + (net >= 0 ? 'result-won' : 'result-lost')}>
                    Net this hand: {net >= 0 ? '+' : '−'}{sym}{Math.abs(net).toLocaleString()}
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
              onClick={() => setStep(s => s + 1)}
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
