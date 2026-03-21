import { calcPosition, getSbSeat } from '../utils';

// Controlled component — state lives in parent (HandRecorder).
// Props:
//   session    — session object (totalSeats, seats)
//   buttonSeat — which seat has the button
//   value      — { bb, seatIn, raiseOn, raiseBbs, straddle, adjust }
//   onChange   — (newValue, computedPot, inCount) => void
export default function PotBuilder({ session, buttonSeat, value, onChange }) {
  if (!session || !buttonSeat) {
    return (
      <div className="text-muted text-sm" style={{ padding: '12px 0' }}>
        Set button seat in Step 0 first.
      </div>
    );
  }

  const { totalSeats, seats = [] } = session;
  const { bb, seatIn, raiseOn, raiseBbs, straddle, adjust } = value;
  const sbSeat = getSbSeat(buttonSeat, totalSeats);

  function compute(v) {
    const inCount = Object.values(v.seatIn).filter(Boolean).length;
    const pricePerPlayer = v.raiseOn ? v.raiseBbs * v.bb
                         : v.straddle ? 2 * v.bb
                         : v.bb;
    const sbDead = v.seatIn[sbSeat] ? 0 : 0.5 * v.bb;
    const pot = (inCount * pricePerPlayer) + sbDead + (v.adjust || 0);
    return { pot, inCount };
  }

  function update(patch) {
    const next = { ...value, ...patch };
    const { pot, inCount } = compute(next);
    onChange(next, pot, inCount);
  }

  function toggleSeat(seatNum) {
    update({ seatIn: { ...seatIn, [seatNum]: !seatIn[seatNum] } });
  }

  function adjustPot(deltaBbs) {
    update({ adjust: (adjust || 0) + deltaBbs * bb });
  }

  function seatName(seatNum) {
    const s = seats.find(s => s.seatNum === seatNum);
    if (!s?.name) return '';
    return s.name.length > 8 ? s.name.slice(0, 7) + '…' : s.name;
  }

  // Current computed values for display
  const inCount = Object.values(seatIn).filter(Boolean).length;
  const pricePerPlayer = raiseOn ? raiseBbs * bb : straddle ? 2 * bb : bb;
  const sbDead = seatIn[sbSeat] ? 0 : 0.5 * bb;
  const pot = (inCount * pricePerPlayer) + sbDead + (adjust || 0);

  const breakdown = [];
  if (inCount > 0) breakdown.push(`${inCount} × $${pricePerPlayer}`);
  if (sbDead > 0) breakdown.push(`+$${sbDead} SB dead`);
  if (adjust > 0) breakdown.push(`+$${adjust} adj`);
  if (adjust < 0) breakdown.push(`$${adjust} adj`);

  const cols = totalSeats <= 6 ? 3 : totalSeats <= 8 ? 4 : 3;

  return (
    <div className="pot-builder">
      {/* Top row: BB, Raise, Straddle */}
      <div className="pot-builder-top">
        <label className="pot-builder-field">
          <span className="form-label" style={{ marginBottom: 0 }}>BB&nbsp;($)</span>
          <input
            type="number"
            className="form-input"
            style={{ width: 72, minHeight: 36 }}
            value={bb}
            onChange={e => update({ bb: parseFloat(e.target.value) || 1 })}
            inputMode="decimal"
          />
        </label>

        <label className="pot-builder-field pot-builder-check">
          <input
            type="checkbox"
            checked={raiseOn}
            onChange={e => update({ raiseOn: e.target.checked })}
          />
          <span>Raise</span>
          {raiseOn && (
            <>
              <input
                type="number"
                className="form-input"
                style={{ width: 54, minHeight: 36 }}
                value={raiseBbs}
                onChange={e => update({ raiseBbs: parseFloat(e.target.value) || 1 })}
                inputMode="decimal"
              />
              <span className="text-muted text-sm">bb</span>
            </>
          )}
        </label>

        <label className="pot-builder-field pot-builder-check">
          <input
            type="checkbox"
            checked={straddle}
            onChange={e => update({ straddle: e.target.checked })}
          />
          <span>Straddle</span>
        </label>
      </div>

      {/* Seat grid */}
      <div
        className="pot-seat-grid"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {Array.from({ length: totalSeats }, (_, i) => i + 1).map(seatNum => {
          const pos = calcPosition(totalSeats, seatNum, buttonSeat);
          const inPot = !!seatIn[seatNum];
          const name = seatName(seatNum);
          return (
            <button
              key={seatNum}
              className={'pot-seat-btn' + (inPot ? ' in-pot' : '')}
              onClick={() => toggleSeat(seatNum)}
            >
              <span className="pot-seat-pos">{pos}</span>
              <span className="pot-seat-num">#{seatNum}</span>
              {name && <span className="pot-seat-name">{name}</span>}
            </button>
          );
        })}
      </div>

      {/* Pot display */}
      <div className="pot-display">
        <div className="pot-display-amount">
          ${pot % 1 === 0 ? pot : pot.toFixed(2)}
        </div>
        {breakdown.length > 0 && (
          <div className="text-muted text-sm">{breakdown.join('  ')}</div>
        )}
      </div>

      {/* Fine-tune adjust buttons */}
      <div className="pot-adjust-row">
        {[[-10, '−10bb'], [-1, '−1bb'], [1, '+1bb'], [10, '+10bb']].map(([delta, label]) => (
          <button key={label} className="quick-add-btn" onClick={() => adjustPot(delta)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
