import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { get, getHandsBySession, put } from '../db';
import { uuid, TABLE_POSITIONS, nextHandNum } from '../utils';
import InlineCardPicker from '../components/InlineCardPicker';

export default function QuickHandEntry() {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [position, setPosition] = useState('');
  const [holeCards, setHoleCards] = useState([null, null]);
  const [outcome, setOutcome] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    get('sessions', sessionId).then(setSession);
  }, [sessionId]);

  async function saveHand() {
    const prevHands = await getHandsBySession(sessionId);
    const handNum = nextHandNum(prevHands);

    const record = {
      id: uuid(),
      sessionId,
      handNum,
      myPosition: position,
      holeCards,
      result: {
        outcome,
        amount: outcome === 'folded' ? '' : amount,
      },
      notes,
      mySeatAtHand: session.mySeat,
      seatMapAtHand: session.seats,
      quick: true,
      createdAt: new Date().toISOString(),
    };

    await put('hands', record);
    navigate(`/session/${sessionId}`);
  }

  function canSave() {
    return position && holeCards[0] && holeCards[1] && outcome;
  }

  if (!session) return <div className="screen"><div className="text-muted">Loading…</div></div>;

  const positions = TABLE_POSITIONS[session.totalSeats] || TABLE_POSITIONS[9];

  return (
    <div className="screen" style={{ paddingBottom: 'calc(var(--nav-height) + 80px)' }}>
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigate(`/session/${sessionId}`)}>← Back</button>
        <h1>Quick Entry</h1>
      </div>

      {/* Position */}
      <div className="form-group">
        <label className="form-label">My Position</label>
        <div className="quick-pos-grid">
          {positions.map(pos => (
            <button
              key={pos}
              className={'quick-pos-btn' + (position === pos ? ' selected' : '')}
              onClick={() => setPosition(pos)}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* Hole Cards */}
      <div className="form-group">
        <label className="form-label">Hole Cards</label>
        <InlineCardPicker
          cards={holeCards}
          onChange={setHoleCards}
          usedCards={[]}
        />
      </div>

      {/* Result */}
      <div className="form-group">
        <label className="form-label">Result</label>
        <div className="action-row">
          {[
            { key: 'won', label: 'Won' },
            { key: 'lost', label: 'Lost' },
            { key: 'folded', label: 'Folded' },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={
                'action-btn' +
                (outcome === key
                  ? ' selected' + (key === 'won' ? '' : ' fold')
                  : '')
              }
              onClick={() => { setOutcome(key); if (key === 'folded') setAmount(''); }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {outcome && outcome !== 'folded' && (
        <div className="form-group">
          <label className="form-label">Amount</label>
          <input
            type="number"
            className="form-input"
            placeholder="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            inputMode="numeric"
          />
        </div>
      )}

      {/* Notes */}
      <div className="form-group">
        <label className="form-label">Notes (optional)</label>
        <input
          type="text"
          className="form-input"
          placeholder="Any quick notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      <div className="sticky-bottom">
        <button
          className="btn btn-primary btn-full"
          onClick={saveHand}
          disabled={!canSave()}
          style={{ opacity: canSave() ? 1 : 0.5 }}
        >
          Save Hand
        </button>
      </div>
    </div>
  );
}
