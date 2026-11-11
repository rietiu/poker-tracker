import { useState, useEffect, useRef } from 'react';
import {
  PREFLOP_ACTION_ORDER, POSTFLOP_ACTION_ORDER, POSITION_COLORS, computeStreetState,
  materializeStreet, tapsFromActions, facingTap, betTap, allInTap,
} from '../utils';

const POT_FRACS = [
  { label: '1/3', frac: 1 / 3 },
  { label: '1/2', frac: 1 / 2 },
  { label: '2/3', frac: 2 / 3 },
  { label: 'Pot', frac: 1 },
];
const BB_OPEN_SIZES = [2.5, 3, 4, 5];     // pre-flop open, in BB
const RERAISE_MULTIPLES = [2.5, 3, 4];    // facing a bet, × current bet

const CURRENCY_SYMBOLS = { USD: '$', PHP: '₱', EUR: '€', GBP: '£' };

function actionBadge(action, amount, sym, allIn) {
  if (allIn) return `AI${sym}${amount}`;
  if (action === 'fold') return 'F';
  if (action === 'check') return 'X';
  if (action === 'call') return `C${sym}${amount}`;
  if (action === 'bet') return `B${sym}${amount}`;
  if (action === 'raise') return `R${sym}${amount}`;
  return '';
}

/**
 * Fast sequencer: tap only the seats that acted, in order. Seats skipped
 * between taps (and every seat still due on "Done") are recorded as folds.
 * Tap the last-tapped seat again to turn its action into a bet / raise.
 *
 * Props:
 *   totalSeats, street, myPosition, activePositions, actions, startPot, bb, sb, currency
 *   onChange(actions, endPot)   — stored actions for this street
 *   onComplete(actions)         — street finished (closed actions, or hero folded)
 *   prevPreflopActions          — previous hand's pre-flop actions ("Same as last hand")
 *   allInBefore                 — positions all-in on an earlier street (never asked to act)
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
  sb = null,
  currency = 'USD',
  onComplete = null,
  prevPreflopActions = null,
  allInBefore = [],
}) {
  const sym = CURRENCY_SYMBOLS[currency] || '$';
  const isPreflop = street === 'preflop';
  const sbVal = sb != null ? sb : Math.round(bb / 2);
  const roundToBB = (amount) => (bb > 0 ? Math.round(amount / bb) * bb : Math.round(amount));

  const fullOrder = isPreflop
    ? (PREFLOP_ACTION_ORDER[totalSeats] || PREFLOP_ACTION_ORDER[9])
    : (POSTFLOP_ACTION_ORDER[totalSeats] || POSTFLOP_ACTION_ORDER[9]);
  const actionOrder = fullOrder.filter(p => activePositions.includes(p));

  const ctx = {
    actionOrder,
    activePositions,
    initialBet: isPreflop ? bb : 0,
    initialCommitted: isPreflop ? { SB: sbVal, BB: bb } : {},
    hero: myPosition,
    allInBefore,
  };
  const stateOf = (acts) =>
    computeStreetState(acts, actionOrder, activePositions, ctx.initialBet, ctx.initialCommitted, allInBefore);

  const taps = tapsFromActions(actions, myPosition);
  const open = materializeStreet(taps, ctx);
  const state = stateOf(open.actions);
  const closed = materializeStreet(taps, { ...ctx, close: true });
  const heroFolded = taps.some(t => t.pos === myPosition && t.action === 'fold');
  const totalPot = startPot + state.runningPot;
  const lastTap = taps[taps.length - 1];

  const [raiseFor, setRaiseFor] = useState(null);
  const [pendingAmount, setPendingAmount] = useState('');

  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  // Auto-advance once the action is unambiguously closed (skip on mount).
  const hasMountedRef = useRef(false);
  const autoDone = taps.length > 0 && !heroFolded && !open.error && open.nextPos === null;
  useEffect(() => {
    if (!hasMountedRef.current) { hasMountedRef.current = true; return; }
    if (!autoDone) return;
    const t = setTimeout(() => onCompleteRef.current?.(open.actions), 800);
    return () => clearTimeout(t);
  }, [autoDone, taps.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Write a new tap log back as stored actions. Returns the materialised result or null.
  function emit(newTaps, close = false) {
    const m = materializeStreet(newTaps, { ...ctx, close });
    if (m.error) return null;
    onChange(m.actions, startPot + stateOf(m.actions).runningPot);
    return m;
  }

  function canTap(pos) {
    if (heroFolded) return false;
    return !materializeStreet([...taps, { pos, action: 'check', amount: 0 }], ctx).error;
  }

  function handleTileTap(pos) {
    if (lastTap && lastTap.pos === pos && lastTap.action !== 'fold') {
      setRaiseFor(raiseFor === pos ? null : pos);
      setPendingAmount('');
      return;
    }
    if (!canTap(pos)) return;
    setRaiseFor(null);
    emit([...taps, facingTap(taps, pos, ctx)]);
  }

  // Bet / raise replaces the last tap (which belongs to raiseFor).
  const tapsBeforeRaise = taps.slice(0, -1);
  const raiseBase = raiseFor ? stateOf(materializeStreet(tapsBeforeRaise, ctx).actions) : null;
  const pendingTap = raiseFor ? betTap(tapsBeforeRaise, raiseFor, pendingAmount, ctx) : null;
  const pendingAllIn = raiseFor ? allInTap(tapsBeforeRaise, raiseFor, pendingAmount, ctx) : null;

  function commitAllIn() {
    if (!pendingAllIn) return;
    setRaiseFor(null);
    setPendingAmount('');
    emit([...tapsBeforeRaise, pendingAllIn]);
  }

  function commitBet(amount) {
    const t = betTap(tapsBeforeRaise, raiseFor, amount, ctx);
    if (!t) return;
    setRaiseFor(null);
    setPendingAmount('');
    emit([...tapsBeforeRaise, t]);
  }

  function undo() {
    setRaiseFor(null);
    emit(taps.slice(0, -1));
  }

  function heroFold() {
    setRaiseFor(null);
    const m = emit([...taps, { pos: myPosition, action: 'fold', amount: 0 }]);
    if (m) onCompleteRef.current?.(m.actions);
  }

  function done() {
    setRaiseFor(null);
    const m = emit(taps, true);
    if (m) onCompleteRef.current?.(m.actions);
  }

  // "Same as last hand": longest valid prefix of the previous hand's taps.
  const prevTaps = (() => {
    if (!isPreflop || taps.length > 0 || !prevPreflopActions?.length) return null;
    const candidate = tapsFromActions(prevPreflopActions, null)
      .filter(t => t.action !== 'fold' && actionOrder.includes(t.pos));
    let best = [];
    for (let i = 1; i <= candidate.length; i++) {
      if (materializeStreet(candidate.slice(0, i), ctx).error) break;
      best = candidate.slice(0, i);
    }
    return best.length ? best : null;
  })();

  function sizeChips() {
    if (!raiseBase) return [];
    const base = raiseBase.currentBet;
    if (isPreflop && base <= bb) {
      return BB_OPEN_SIZES.map(m => ({ label: `${m}bb`, amt: Math.round(m * bb) }));
    }
    if (base > 0) {
      return RERAISE_MULTIPLES.map(m => {
        const amt = roundToBB(base * m);
        return { label: `${m}x · ${(amt / bb).toFixed(1).replace(/\.0$/, '')}bb`, amt };
      });
    }
    const potBefore = startPot + raiseBase.runningPot;
    return POT_FRACS.map(({ label, frac }) => ({ label, amt: Math.max(bb, roundToBB(potBefore * frac)) }));
  }

  const heroCanAct = canTap(myPosition);
  const doneLabel = closed.error === 'hero-skipped' ? 'Your action first' : 'Done →';

  return (
    <div className="pos-sequencer">
      <div className="pos-pot-bar">
        <span>Pot <strong>{sym}{totalPot.toLocaleString()}</strong></span>
        {state.nextPos && state.toCall > 0 && (
          <span className="text-muted text-sm"> · To call {sym}{state.toCall.toLocaleString()}</span>
        )}
      </div>

      <div className="seq-hint text-muted text-xs">
        {taps.length === 0 && !closed.error && closed.nextPos === null && closed.actions.length === 0
          ? 'No one can act — everyone left is all-in. Tap Done.'
          : 'Tap seats that acted, in order — untapped seats fold. Tap the last seat again to bet / raise / all-in.'}
      </div>

      <div className="pos-grid">
        {actionOrder.map(pos => {
          const act = state.lastActionByPos[pos];
          const tapped = taps.some(t => t.pos === pos);
          const isFolded = state.foldedSet.has(pos);
          const implied = isFolded && !tapped;
          const isNext = pos === state.nextPos;
          const isMe = pos === myPosition;
          const isLast = lastTap?.pos === pos && lastTap.action !== 'fold';
          const enabled = isLast || canTap(pos);
          const posColor = POSITION_COLORS[pos] || '#adb5bd';
          return (
            <button
              key={pos}
              className={
                'pos-tile' +
                (isNext ? ' pos-active' : '') +
                (isMe ? ' pos-me' : '') +
                (isFolded ? ' pos-folded' : '') +
                (implied ? ' pos-implied' : '') +
                (raiseFor === pos ? ' pos-raising' : '')
              }
              onClick={() => handleTileTap(pos)}
              disabled={!enabled}
              style={isNext ? { borderColor: posColor, boxShadow: `0 0 0 2px ${posColor}44` } : isMe ? { borderColor: '#f4c430' } : {}}
            >
              <span className="pos-tile-name" style={{ color: isNext ? posColor : undefined }}>{pos}</span>
              {isMe && <span className="pos-tile-me">You</span>}
              {allInBefore.includes(pos) && <span className="pos-tile-action act-bet">All-in</span>}
              {act && (
                <span
                  className={
                    'pos-tile-action' +
                    (act.action === 'fold' ? ' act-fold' :
                     act.action === 'check' ? ' act-check' :
                     act.action === 'call' ? ' act-call' : ' act-bet')
                  }
                >
                  {actionBadge(act.action, act.amount, sym, act.allIn)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {raiseFor && (
        <div className="pos-raise-panel">
          <div className="text-sm mb-8">
            {raiseFor === myPosition ? 'Your' : raiseFor} {raiseBase.currentBet > 0 ? 'raise to' : 'bet'}
          </div>
          <div className="pot-size-row">
            {sizeChips().map(({ label, amt }) => (
              <button key={label} className="pot-size-btn" onClick={() => commitBet(amt)}>
                <span className="pot-size-label">{label}</span>
                <span className="pot-size-amt">{sym}{amt.toLocaleString()}</span>
              </button>
            ))}
          </div>
          <div className="row gap-8 mt-8">
            <input
              type="number"
              className="form-input"
              placeholder={`Amount ${sym}`}
              value={pendingAmount}
              onChange={e => setPendingAmount(e.target.value)}
              inputMode="numeric"
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary btn-sm" disabled={!pendingTap} style={{ opacity: pendingTap ? 1 : 0.5 }} onClick={() => commitBet(pendingAmount)}>
              OK
            </button>
            <button className="btn btn-secondary btn-sm seq-allin" disabled={!pendingAllIn} style={{ opacity: pendingAllIn ? 1 : 0.5 }} onClick={commitAllIn}>
              All-in
            </button>
          </div>
          <div className="text-muted text-xs mt-4">All-in: type the player's whole stack for this street (less than the bet = all-in call).</div>
          {pendingAmount !== '' && !pendingTap && !pendingAllIn && (
            <div className="text-xs mt-4 result-lost">
              {raiseBase.currentBet > 0
                ? `Raise must be more than ${sym}${raiseBase.currentBet.toLocaleString()}`
                : 'Bet must be more than 0'}
            </div>
          )}
        </div>
      )}

      <div className="seq-controls">
        {prevTaps && (
          <button className="btn btn-secondary btn-sm" onClick={() => emit(prevTaps)}>Same as last hand</button>
        )}
        <button className="btn btn-secondary btn-sm" onClick={undo} disabled={taps.length === 0} style={{ opacity: taps.length ? 1 : 0.5 }}>
          ↶ Undo
        </button>
        {!heroFolded && heroCanAct && (
          <button className="btn btn-secondary btn-sm seq-fold" onClick={heroFold}>I fold</button>
        )}
        <button className="btn btn-primary btn-sm" onClick={done} disabled={!!closed.error || heroFolded} style={{ opacity: closed.error || heroFolded ? 0.5 : 1 }}>
          {doneLabel}
        </button>
      </div>
    </div>
  );
}
