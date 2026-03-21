import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { put, getSessionsSorted } from '../db';
import { uuid } from '../utils';

const SEAT_COUNTS = [6, 8, 9];
const CURRENCIES = [
  { label: 'USD', symbol: '$' },
  { label: 'PHP', symbol: '₱' },
  { label: 'EUR', symbol: '€' },
  { label: 'GBP', symbol: '£' },
];

export default function SessionSetup() {
  const navigate = useNavigate();
  const [venue, setVenue] = useState('');
  const [game, setGame] = useState('NL $1/$2');
  const [currency, setCurrency] = useState('USD');
  const [totalSeats, setTotalSeats] = useState(6);
  const [mySeat, setMySeat] = useState(1);
  const [myStack, setMyStack] = useState('');
  const [rakeType, setRakeType] = useState('percent');
  const [rake, setRake] = useState('');
  const [rakeMax, setRakeMax] = useState('');
  const [pastSessions, setPastSessions] = useState([]);

  useEffect(() => {
    getSessionsSorted().then(all => setPastSessions(all.slice(0, 5)));
  }, []);

  function applyPreset(s) {
    if (s.venue) setVenue(s.venue);
    if (s.game) setGame(s.game);
    if (s.currency) setCurrency(s.currency);
    if (s.totalSeats) setTotalSeats(s.totalSeats);
    if (s.rakeType) setRakeType(s.rakeType);
    if (s.rake != null) setRake(String(s.rake));
    if (s.rakeMax != null) setRakeMax(String(s.rakeMax));
  }

  async function handleStart() {
    const seatArr = Array.from({ length: totalSeats }, (_, i) => ({
      seatNum: i + 1,
      name: '',
      playerId: null,
      tags: [],
      estimatedStack: '',
    }));

    const session = {
      id: uuid(),
      date: new Date().toISOString(),
      venue: venue.trim(),
      game: game.trim(),
      currency,
      totalSeats,
      rakeType,
      rake: rake !== '' ? Number(rake) : null,
      rakeMax: rakeMax !== '' ? Number(rakeMax) : 0,
      myStack: Number(myStack) || 0,
      mySeat,
      seats: seatArr,
      createdAt: new Date().toISOString(),
    };

    await put('sessions', session);
    navigate(`/session/${session.id}`);
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
        <h1>New Session</h1>
      </div>

      {pastSessions.length > 0 && (
        <div className="form-group">
          <label className="form-label">Quick-start from previous</label>
          <div className="preset-scroll">
            {pastSessions.map(s => (
              <button
                key={s.id}
                className="preset-card"
                onClick={() => applyPreset(s)}
              >
                <div className="preset-venue">{s.venue || 'Unnamed'}</div>
                <div className="preset-meta">{s.game} · {s.totalSeats}-max</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Venue (optional)</label>
        <input
          type="text"
          className="form-input"
          placeholder="e.g. Resorts World"
          value={venue}
          onChange={e => setVenue(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Game / Blinds</label>
        <input
          type="text"
          className="form-input"
          placeholder="e.g. NL P50/P100"
          value={game}
          onChange={e => setGame(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Currency</label>
        <div className="pill-group">
          {CURRENCIES.map(c => (
            <button
              key={c.label}
              className={'pill' + (currency === c.label ? ' selected' : '')}
              onClick={() => setCurrency(c.label)}
            >
              {c.symbol} {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Table Size</label>
        <div className="pill-group">
          {SEAT_COUNTS.map(n => (
            <button
              key={n}
              className={'pill' + (totalSeats === n ? ' selected' : '')}
              onClick={() => setTotalSeats(n)}
            >
              {n}-handed
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">My Seat</label>
        <div className="seat-grid">
          {Array.from({ length: totalSeats }, (_, i) => i + 1).map(n => (
            <button
              key={n}
              className={'seat-btn' + (mySeat === n ? ' is-me selected' : '')}
              onClick={() => setMySeat(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">My Starting Stack</label>
        <input
          type="number"
          className="form-input"
          placeholder="e.g. 10000"
          value={myStack}
          onChange={e => setMyStack(e.target.value)}
          inputMode="numeric"
        />
      </div>

      <div className="form-group">
        <label className="form-label">Commission / Rake <span className="text-muted text-xs">(optional)</span></label>
        <div className="pill-group mb-8">
          <button className={'pill' + (rakeType === 'percent' ? ' selected' : '')} onClick={() => setRakeType('percent')}>% of pot</button>
          <button className={'pill' + (rakeType === 'flat' ? ' selected' : '')} onClick={() => setRakeType('flat')}>Flat per hand</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="number"
            className="form-input"
            placeholder={rakeType === 'percent' ? 'e.g. 5 (for 5%)' : 'e.g. 500 (fixed)'}
            value={rake}
            onChange={e => setRake(e.target.value)}
            inputMode="numeric"
            style={{ flex: 1 }}
          />
          {rakeType === 'percent' && (
            <input
              type="number"
              className="form-input"
              placeholder="Max cap"
              value={rakeMax}
              onChange={e => setRakeMax(e.target.value)}
              inputMode="numeric"
              style={{ width: 100 }}
            />
          )}
        </div>
      </div>

      <div style={{ paddingBottom: 24 }}>
        <button className="btn btn-primary btn-full" onClick={handleStart}>
          Start Session
        </button>
      </div>
    </div>
  );
}
