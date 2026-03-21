import { useState } from 'react';
import { calcPosition, getSbSeat, getBbSeat } from '../utils';

const ACTIONS = ['fold', 'check', 'call', 'bet', 'raise'];

const POT_FRACS = [
  { label: '1/3', frac: 1 / 3 },
  { label: '1/2', frac: 1 / 2 },
  { label: '2/3', frac: 2 / 3 },
  { label: 'Pot', frac: 1 },
];

function getSeatOrder(buttonSeat, totalSeats, activeSeatNums, street) {
  let startSeat;
  if (street === 'preflop') {
    const bbSeat = getBbSeat(buttonSeat, totalSeats);
    startSeat = (bbSeat % totalSeats) + 1;
  } else {
    startSeat = getSbSeat(buttonSeat, totalSeats);
  }
  const order = [];
  let cur = startSeat;
  for (let i = 0; i < totalSeats; i++) {
    if (activeSeatNums.includes(cur)) order.push(cur);
    cur = (cur % totalSeats) + 1;
  }
  return order;
}

function getNextSeat(seatOrder, actions) {
  const foldedSeats = new Set();
  let lastRaiserIdx = -1;
  const actedSinceLastRaise = new Set();

  for (const a of actions) {
    const idx = seatOrder.indexOf(a.seat);
    if (idx === -1) continue;
    if (a.action === 'fold') {
      foldedSeats.add(a.seat);
      actedSinceLastRaise.add(a.seat);
    } else if (a.action === 'bet' || a.action === 'raise') {
      lastRaiserIdx = idx;
      actedSinceLastRaise.clear();
      actedSinceLastRaise.add(a.seat);
    } else {
      actedSinceLastRaise.add(a.seat);
    }
  }

  const active = seatOrder.filter(s => !foldedSeats.has(s));
  if (active.length <= 1) return null;

  const n = seatOrder.length;
  const startIdx = lastRaiserIdx === -1 ? 0 : (lastRaiserIdx + 1) % n;
  for (let i = 0; i < n; i++) {
    const idx = (startIdx + i) % n;
    const seat = seatOrder[idx];
    if (!foldedSeats.has(seat) && !actedSinceLastRaise.has(seat)) {
      return seat;
    }
  }
  return null;
}

// Returns { runningPot, currentBet }
function computePotState(actions, startPot) {
  let runningPot = startPot;
  let currentBet = 0;
  for (const a of actions) {
    if (a.action === 'bet' || a.action === 'raise') {
      currentBet = a.amount || 0;
      runningPot += currentBet;
    } else if (a.action === 'call') {
      runningPot += a.amount || 0;
    }
  }
  return { runningPot, currentBet };
}

export default function ActionSequencer({ session, buttonSeat, street, activeSeatNums, actions, onChange, startPot = 0 }) {
  const [pendingAction, setPendingAction] = useState('');
  const [pendingAmount, setPendingAmount] = useState('');

  const { totalSeats, seats = [], mySeat } = session;
  const seatOrder = getSeatOrder(buttonSeat, totalSeats, activeSeatNums, street);
  const nextSeat = getNextSeat(seatOrder, actions);
  const { runningPot, currentBet } = computePotState(actions, startPot);

  function getSeatInfo(seatNum) {
    const s = seats.find(x => x.seatNum === seatNum);
    const sb = getSbSeat(buttonSeat, totalSeats);
    const bb = getBbSeat(buttonSeat, totalSeats);
    const role = seatNum === buttonSeat ? 'btn' : seatNum === sb ? 'sb' : seatNum === bb ? 'bb' : null;
    return {
      pos: calcPosition(totalSeats, seatNum, buttonSeat),
      name: s?.name || '',
      role,
    };
  }

  function commitAction(action, amount) {
    if (nextSeat === null) return;
    const newActions = [...actions, { seat: nextSeat, action, amount }];
    const { runningPot: endPot } = computePotState(newActions, startPot);
    onChange(newActions, endPot);
    setPendingAction('');
    setPendingAmount('');
  }

  function handleActionClick(a) {
    // Fold, check, call: commit immediately (one tap)
    if (a === 'fold' || a === 'check') {
      commitAction(a, 0);
    } else if (a === 'call') {
      commitAction('call', currentBet);
    } else {
      // bet/raise: enter amount first
      setPendingAction(a === pendingAction ? '' : a);
      setPendingAmount('');
    }
  }

  const showAmountInput = pendingAction === 'bet' || pendingAction === 'raise';

  return (
    <div className="action-seq">
      {/* Running pot */}
      {startPot > 0 && (
        <div className="seq-pot-display">
          Pot: <strong>${runningPot.toLocaleString()}</strong>
        </div>
      )}

      {/* Recorded actions — tap to undo from that point */}
      {actions.length > 0 && (
        <div className="seq-list">
          {actions.map((a, i) => {
            const { pos, name, role } = getSeatInfo(a.seat);
            const isMe = a.seat === mySeat;
            return (
              <button
                key={i}
                className={`seq-row${isMe ? ' is-me' : ''}${role ? ` role-${role}` : ''}`}
                onClick={() => {
                  const newActions = actions.slice(0, i);
                  const { runningPot: endPot } = computePotState(newActions, startPot);
                  onChange(newActions, endPot);
                }}
              >
                <span className="seq-pos">{pos}</span>
                <span className="seq-seat">
                  Seat {a.seat}{name ? ` · ${name}` : ''}{isMe ? ' (You)' : ''}
                </span>
                <span className={`seq-badge ${a.action}`}>
                  {a.action.charAt(0).toUpperCase() + a.action.slice(1)}
                  {a.amount ? ` $${a.amount.toLocaleString()}` : ''}
                </span>
                <span className="seq-undo">✕</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Current player prompt */}
      {nextSeat !== null && (
        <div className={`seq-prompt${actions.length > 0 ? ' has-list' : ''}`}>
          {(() => {
            const { pos, name, role } = getSeatInfo(nextSeat);
            const isMe = nextSeat === mySeat;
            return (
              <>
                <div className="seq-prompt-label">
                  {isMe ? 'Your action' : `Seat ${nextSeat}`}
                </div>
                <div className={`seq-prompt-info${role ? ` role-${role}` : ''}`}>
                  {pos}{name ? ` · ${name}` : ''}{isMe ? ' (You)' : ''}
                </div>
                {currentBet > 0 && (
                  <div className="seq-current-bet">
                    To call: ${currentBet.toLocaleString()}
                  </div>
                )}
              </>
            );
          })()}

          <div className="action-row mt-8">
            {ACTIONS.map(a => (
              <button
                key={a}
                className={`action-btn ${a}${pendingAction === a ? ' selected' : ''}`}
                onClick={() => handleActionClick(a)}
              >
                {a === 'call' && currentBet > 0
                  ? `Call $${currentBet.toLocaleString()}`
                  : a.charAt(0).toUpperCase() + a.slice(1)}
              </button>
            ))}
          </div>

          {/* Pot-sized quick buttons for bet/raise */}
          {showAmountInput && runningPot > 0 && (
            <div className="pot-size-row mt-8">
              {POT_FRACS.map(({ label, frac }) => {
                const amt = Math.round(runningPot * frac);
                const isSelected = pendingAmount === String(amt);
                return (
                  <button
                    key={label}
                    className={'pot-size-btn' + (isSelected ? ' selected' : '')}
                    onClick={() => setPendingAmount(String(amt))}
                  >
                    <span className="pot-size-label">{label}</span>
                    <span className="pot-size-amt">${amt.toLocaleString()}</span>
                  </button>
                );
              })}
            </div>
          )}

          {showAmountInput && (
            <input
              type="number"
              className="form-input mt-8"
              placeholder="Amount $"
              value={pendingAmount}
              onChange={e => setPendingAmount(e.target.value)}
              inputMode="numeric"
            />
          )}

          {showAmountInput && (
            <button
              className="btn btn-primary btn-full mt-8"
              onClick={() => commitAction(pendingAction, Number(pendingAmount) || 0)}
              disabled={!pendingAmount}
              style={{ opacity: pendingAmount ? 1 : 0.5 }}
            >
              Record {pendingAction.charAt(0).toUpperCase() + pendingAction.slice(1)}
              {pendingAmount ? ` $${Number(pendingAmount).toLocaleString()}` : ''}
            </button>
          )}
        </div>
      )}

      {nextSeat === null && actions.length > 0 && (
        <div className="seq-done">
          Street complete — Pot: ${runningPot.toLocaleString()}
        </div>
      )}
    </div>
  );
}
