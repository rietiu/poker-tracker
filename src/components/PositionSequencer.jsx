import { useState, useEffect, useRef } from 'react';
import { PREFLOP_ACTION_ORDER, POSTFLOP_ACTION_ORDER, POSITION_COLORS } from '../utils';

const POT_FRACS = [
  { label: '1/3', frac: 1 / 3 },
  { label: '1/2', frac: 1 / 2 },
  { label: '2/3', frac: 2 / 3 },
  { label: 'Pot', frac: 1 },
];

// Preflop open-raise sizes (BB multiples) — 4 options
const BB_OPEN_SIZES = [2.5, 3, 4, 5];
// Re-raise multiples (of the current bet) — 4 options
const RERAISE_MULTIPLES = [2.5, 3, 4, 5];

const CURRENCY_SYMBOLS = { USD: '$', PHP: '₱', EUR: '€', GBP: '£' };

// Returns a short action badge string e.g. "F", "X", "C$10", "B$30", "R$60"
function actionBadge(action, amount) {
  if (action === 'fold') return 'F';
  if (action === 'check') return 'X';
  if (action === 'call') return `C$${amount}`;
  if (action === 'bet') return `B$${amount}`;
  if (action === 'raise') return `R$${amount}`;
  return '';
}

// computeStreetState — tracks full street action state
// initialCommitted: { [pos]: number } — chips already posted before any explicit action (SB/BB for preflop)
function computeStreetState(actions, actionOrder, activePositions, initialBet, initialCommitted = {}) {
  const foldedSet = new Set();
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

    lastActionByPos[pos] = { action: a.action, amount: a.amount || 0 };

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

  if (stillIn.length <= 1) {
    return { nextPos: null, currentBet, runningPot, foldedSet, lastActionByPos, toCall: 0 };
  }

  // Find nextPos: scan from lastAggressor+1 for someone not folded + not actedSinceLastRaise
  const n = actionOrder.length;
  const startIdx = lastAggressorIdx === -1 ? 0 : (lastAggressorIdx + 1) % n;

  let nextPos = null;
  for (let i = 0; i < n; i++) {
    const idx = (startIdx + i) % n;
    const pos = actionOrder[idx];
    if (!activePosSet.has(pos)) continue;
    if (foldedSet.has(pos)) continue;
    if (!actedSinceLastRaise.has(pos)) {
      nextPos = pos;
      break;
    }
  }

  // toCall = how much the next player needs to add from their stack to call
  const toCall = nextPos ? Math.max(0, currentBet - (committed[nextPos] || 0)) : 0;

  return { nextPos, currentBet, runningPot, foldedSet, lastActionByPos, toCall };
}

/**
 * Props:
 *   totalSeats: 6 | 8 | 9
 *   street: 'preflop' | 'flop' | 'turn' | 'river'
 *   myPosition: string
 *   activePositions: string[]   — positions still in the hand for this street
 *   actions: { pos, action, amount }[]
 *   onChange: (actions, endPot) => void
 *   startPot: number            — pot size at start of street (before any actions)
 *   bb: number
 */
export default function PositionSequencer({
  totalSeats,
  street,
  myPosition,
  activePositions,
  actions,
  onChange,
  startPot = 0,
  bb = 2,
  sb = null, // SB post amount; defaults to Math.round(bb/2) if null
  currency = 'USD',
  onComplete = null,
}) {
  const sym = CURRENCY_SYMBOLS[currency] || '$';

  // Round an amount to nearest whole BB
  const roundToBB = (amount) => bb > 0 ? Math.round(amount / bb) * bb : Math.round(amount);

  // Fire onComplete when nextPos transitions to null (not on mount)
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  const hasMountedRef = useRef(false);
  const [pendingAmount, setPendingAmount] = useState('');
  const [showRaisePanel, setShowRaisePanel] = useState(false);

  const isPreflop = street === 'preflop';
  const initialBet = isPreflop ? bb : 0;

  // For preflop, seed committed amounts with blind posts so SB/BB calls are computed correctly
  const sbVal = sb != null ? sb : Math.round(bb / 2);
  const initialCommitted = isPreflop ? { SB: sbVal, BB: bb } : {};

  const fullOrder = isPreflop
    ? (PREFLOP_ACTION_ORDER[totalSeats] || PREFLOP_ACTION_ORDER[9])
    : (POSTFLOP_ACTION_ORDER[totalSeats] || POSTFLOP_ACTION_ORDER[9]);

  // Only positions present at this table
  const actionOrder = fullOrder.filter(p => activePositions.includes(p));

  const { nextPos, currentBet, runningPot, foldedSet, lastActionByPos, toCall } =
    computeStreetState(actions, actionOrder, activePositions, initialBet, initialCommitted);

  const totalPot = startPot + runningPot;

  // BB option logic: if preflop and nextPos === BB and no raise above BB
  const bbCanCheck =
    isPreflop &&
    nextPos === 'BB' &&
    currentBet <= bb &&
    !actions.some(a => a.action === 'raise' || (a.action === 'bet' && a.amount > bb));

  // Reset raise panel when next actor changes
  useEffect(() => {
    setShowRaisePanel(false);
    setPendingAmount('');
  }, [nextPos]);

  function commitAction(action, amount) {
    if (nextPos === null) return;
    const newActions = [...actions, { pos: nextPos, action, amount: amount || 0 }];
    // Recompute endPot with same initialCommitted so blind posts aren't double-counted
    const { runningPot: newRunning } = computeStreetState(
      newActions, actionOrder, activePositions, initialBet, initialCommitted
    );
    onChange(newActions, startPot + newRunning);
  }

  function handleFold() { commitAction('fold', 0); }
  function handleCheck() { commitAction('check', 0); }
  // Store currentBet (full call price) — computeStreetState uses committed tracking to get the delta
  function handleCall() { commitAction('call', currentBet); }
  function handleBetRaise() {
    setShowRaisePanel(v => !v);
    setPendingAmount('');
  }
  function commitBetRaise() {
    const amt = Number(pendingAmount) || 0;
    const action = currentBet > 0 ? 'raise' : 'bet';
    commitAction(action, amt);
    setShowRaisePanel(false);
    setPendingAmount('');
  }

  function undoFrom(idx) {
    const newActions = actions.slice(0, idx);
    const { runningPot: newRunning } = computeStreetState(
      newActions, actionOrder, activePositions, initialBet, initialCommitted
    );
    onChange(newActions, startPot + newRunning);
  }

  const isMe = nextPos === myPosition;

  // Auto-advance: fire onComplete 1s after street is done (skip on mount)
  useEffect(() => {
    if (!hasMountedRef.current) { hasMountedRef.current = true; return; }
    if (nextPos !== null || actions.length === 0) return;
    const t = setTimeout(() => onCompleteRef.current?.(), 1000);
    return () => clearTimeout(t);
  }, [nextPos]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pos-sequencer">
      {/* Pot bar */}
      <div className="pos-pot-bar">
        <span>Pot <strong>{sym}{totalPot.toLocaleString()}</strong></span>
        {toCall > 0 && nextPos && (
          <span className="text-muted text-sm"> · Call {sym}{toCall.toLocaleString()}</span>
        )}
      </div>

      {/* Position grid */}
      <div className="pos-grid">
        {actionOrder.map((pos) => {
          const act = lastActionByPos[pos];
          const isFolded = foldedSet.has(pos);
          const isActive = pos === nextPos;
          const isMyPos = pos === myPosition;
          const posColor = POSITION_COLORS[pos] || '#adb5bd';

          // Find action index for undo
          const lastActIdx = actions.map(a => a.pos).lastIndexOf(pos);

          return (
            <button
              key={pos}
              className={
                'pos-tile' +
                (isActive ? ' pos-active' : '') +
                (isMyPos ? ' pos-me' : '') +
                (isFolded ? ' pos-folded' : '')
              }
              onClick={() => lastActIdx !== -1 && undoFrom(lastActIdx)}
              disabled={lastActIdx === -1}
              style={isActive ? { borderColor: posColor, boxShadow: `0 0 0 2px ${posColor}44` } : isMyPos ? { borderColor: '#f4c430' } : {}}
            >
              <span className="pos-tile-name" style={{ color: isActive ? posColor : undefined }}>
                {pos}
              </span>
              {isMyPos && <span className="pos-tile-me">You</span>}
              {act && (
                <span
                  className={
                    'pos-tile-action' +
                    (act.action === 'fold' ? ' act-fold' :
                     act.action === 'check' ? ' act-check' :
                     act.action === 'call' ? ' act-call' :
                     ' act-bet')
                  }
                >
                  {actionBadge(act.action, act.amount)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Action panel */}
      {nextPos !== null && (
        <div className="pos-action-panel">
          <div className="pos-action-who">
            {isMe ? 'Your action' : `${nextPos} acts`}
          </div>
          <div className="pos-action-btns">
            <button className="pos-btn pos-fold" onClick={handleFold}>Fold</button>

            {(currentBet === 0 || bbCanCheck) ? (
              <button className="pos-btn pos-check" onClick={handleCheck}>Check</button>
            ) : (
              <button className="pos-btn pos-call" onClick={handleCall}>
                Call {sym}{toCall.toLocaleString()}
              </button>
            )}

            <button
              className={'pos-btn pos-raise' + (showRaisePanel ? ' active' : '')}
              onClick={handleBetRaise}
            >
              {currentBet > 0 ? 'Raise' : 'Bet'}
            </button>
          </div>

          {showRaisePanel && (
            <div className="pos-raise-panel">
              {isPreflop ? (
                // Preflop: BB-based sizing
                <div className="pot-size-row mt-8">
                  {currentBet > bb
                    // Facing a raise — show multiples of current bet + total BBs
                    ? RERAISE_MULTIPLES.map(m => {
                        const amt = roundToBB(Math.round(currentBet * m));
                        const bbAmt = (amt / bb).toFixed(1).replace(/\.0$/, '');
                        const isSel = pendingAmount === String(amt);
                        return (
                          <button key={m} className={'pot-size-btn' + (isSel ? ' selected' : '')} onClick={() => setPendingAmount(String(amt))}>
                            <span className="pot-size-label">{m}x · {bbAmt}bb</span>
                            <span className="pot-size-amt">{sym}{amt.toLocaleString()}</span>
                          </button>
                        );
                      })
                    // Open raise — show BB multiples
                    : BB_OPEN_SIZES.map(m => {
                        const amt = Math.round(m * bb);
                        const isSel = pendingAmount === String(amt);
                        return (
                          <button key={m} className={'pot-size-btn' + (isSel ? ' selected' : '')} onClick={() => setPendingAmount(String(amt))}>
                            <span className="pot-size-label">{m}bb</span>
                            <span className="pot-size-amt">{sym}{amt.toLocaleString()}</span>
                          </button>
                        );
                      })
                  }
                </div>
              ) : (
                // Postflop: pot fraction sizing
                totalPot > 0 && (
                  <div className="pot-size-row mt-8">
                    {POT_FRACS.map(({ label, frac }) => {
                      const amt = roundToBB(totalPot * frac);
                      const isSel = pendingAmount === String(amt);
                      return (
                        <button key={label} className={'pot-size-btn' + (isSel ? ' selected' : '')} onClick={() => setPendingAmount(String(amt))}>
                          <span className="pot-size-label">{label}</span>
                          <span className="pot-size-amt">{sym}{amt.toLocaleString()}</span>
                        </button>
                      );
                    })}
                  </div>
                )
              )}
              {/* BB nudge buttons (preflop) */}
              {isPreflop && (
                <div className="bb-nudge-row mt-8">
                  {[-1, -0.5, +0.5, +1].map(d => (
                    <button
                      key={d}
                      className="bb-nudge-btn"
                      onClick={() => {
                        const cur = Number(pendingAmount) || 0;
                        const next = Math.max(0, cur + d * bb);
                        setPendingAmount(String(Math.round(next)));
                      }}
                    >
                      {d > 0 ? '+' : ''}{d}bb
                    </button>
                  ))}
                </div>
              )}
              <input
                type="number"
                className="form-input mt-8"
                placeholder={`Amount ${sym}`}
                value={pendingAmount}
                onChange={e => setPendingAmount(e.target.value)}
                inputMode="numeric"
              />
              <button
                className="btn btn-primary btn-full mt-8"
                onClick={commitBetRaise}
                disabled={!pendingAmount}
                style={{ opacity: pendingAmount ? 1 : 0.5 }}
              >
                {currentBet > 0 ? 'Raise' : 'Bet'}
                {pendingAmount ? ` ${sym}${Number(pendingAmount).toLocaleString()}` : ''}
              </button>
            </div>
          )}
        </div>
      )}

      {nextPos === null && actions.length > 0 && (
        <div className="seq-done">
          Street complete — Pot: {sym}{totalPot.toLocaleString()}
        </div>
      )}
    </div>
  );
}
