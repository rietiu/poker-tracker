// prevPot: the pot carried forward from the previous street.
// The user nudges it with ± buttons rather than typing it manually.
// Actions are handled by ActionSequencer — this component is pot + notes only.
export default function StreetEntry({ value, onChange, prevPot = 0 }) {
  const { pot, notes = '' } = value || {};

  function update(patch) {
    onChange({ ...value, pot, notes, ...patch });
  }

  const effectivePot = (pot !== '' && pot !== null && pot !== undefined)
    ? Number(pot)
    : Number(prevPot);

  function nudge(delta) {
    update({ pot: Math.max(0, effectivePot + delta) });
  }

  return (
    <div>
      {/* Pot — display with nudge buttons */}
      <div className="pot-display-row">
        <div>
          <div className="form-label" style={{ marginBottom: 2 }}>Pot</div>
          <div className="pot-display-value">${effectivePot.toLocaleString()}</div>
        </div>
        <div className="pot-nudge-row">
          {[-100, -25, +25, +100].map(d => (
            <button key={d} className="quick-add-btn" onClick={() => nudge(d)}>
              {d > 0 ? '+' : ''}{d}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Notes (optional)</label>
        <input
          type="text"
          className="form-input"
          placeholder="e.g. villain over-bet"
          value={notes}
          onChange={e => update({ notes: e.target.value })}
        />
      </div>
    </div>
  );
}
