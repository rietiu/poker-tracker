import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { put, getSessionsSorted } from '../db';
import { uuid, CURRENCIES, currencySymbol, recentValues } from '../utils';
import { rakeProfileFor } from '../pots';

const SEAT_COUNTS = [6, 8, 9];

// Past values as tap-to-pick chips; "+ New" (or no history yet) shows a text box.
function OptionPicker({ options, value, onChange, placeholder }) {
  const norm = (v) => (v || '').trim().toLowerCase();
  const [typing, setTyping] = useState(false);
  const inOptions = options.some(o => norm(o) === norm(value));
  const showInput = options.length === 0 || typing || (!!value && !inOptions);
  return (
    <div>
      {options.length > 0 && (
        <div className="pill-group mb-8">
          {options.map(o => (
            <button
              key={o}
              className={'pill' + (norm(o) === norm(value) && !typing ? ' selected' : '')}
              onClick={() => { setTyping(false); onChange(o); }}
            >
              {o}
            </button>
          ))}
          <button
            className={'pill' + (showInput ? ' selected' : '')}
            onClick={() => { setTyping(true); onChange(''); }}
          >
            + New
          </button>
        </div>
      )}
      {showInput && (
        <input
          type="text"
          className="form-input"
          placeholder={placeholder}
          value={value}
          autoFocus={typing}
          onChange={e => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

export default function SessionSetup() {
  const navigate = useNavigate();
  const [venue, setVenue] = useState('');
  const [game, setGame] = useState('NL ₱25/₱50');
  const [currency, setCurrency] = useState('PHP');
  const [totalSeats, setTotalSeats] = useState(6);
  const [mySeat, setMySeat] = useState(1);
  const [myStack, setMyStack] = useState('');
  const [rakeType, setRakeType] = useState('percent');
  const [rake, setRake] = useState('');
  const [rakeMax, setRakeMax] = useState('');
  const [jackpot, setJackpot] = useState('');
  const [rakeEdited, setRakeEdited] = useState(false); // user typed rake fields → don't auto-fill over them
  const [rakeSource, setRakeSource] = useState('');    // e.g. "Okada · NL ₱25/₱50" when auto-filled
  const [allSessions, setAllSessions] = useState([]);
  const pastSessions = allSessions.slice(0, 5);

  useEffect(() => {
    getSessionsSorted().then(all => {
      setAllSessions(all);
      // Start from whatever was played last (currency + stakes); first time → pesos.
      if (all[0]) {
        if (all[0].currency) setCurrency(all[0].currency);
        if (all[0].game) setGame(all[0].game);
      }
    });
  }, []);

  function applyRakeProfile(p) {
    setRakeType(p.rakeType);
    setRake(p.rake != null ? String(p.rake) : '');
    setRakeMax(p.rakeMax ? String(p.rakeMax) : '');
    setJackpot(p.jackpot ? String(p.jackpot) : '');
  }

  // Rake depends on venue + stakes: fill from the last session at the same place and level.
  function autoFillRake(nextVenue, nextGame) {
    if (rakeEdited) return;
    const p = rakeProfileFor(allSessions, nextVenue, nextGame);
    if (p) {
      applyRakeProfile(p);
      setRakeSource(`${nextVenue.trim()} · ${nextGame.trim()}`);
    } else if (rakeSource) {
      applyRakeProfile({ rakeType: 'percent', rake: null, rakeMax: 0, jackpot: 0 });
      setRakeSource('');
    }
  }
  // Options come from past sessions: venues anywhere, stakes in the chosen currency.
  const venueOptions = recentValues(allSessions, 'venue');
  const gameOptions = recentValues(allSessions, 'game', x => (x.currency || 'USD') === currency);
  const usedCurrencies = recentValues(allSessions, 'currency');
  const currencyOrder = [
    ...usedCurrencies.map(code => CURRENCIES.find(c => c.code === code)).filter(Boolean),
    ...CURRENCIES.filter(c => !usedCurrencies.includes(c.code)),
  ];

  function pickCurrency(code) {
    setCurrency(code);
    // Keep the stakes only if they belong to this currency; else offer that currency's last stakes.
    const forCurrency = recentValues(allSessions, 'game', x => (x.currency || 'USD') === code);
    if (!forCurrency.some(g => g.trim().toLowerCase() === game.trim().toLowerCase())) {
      const next = forCurrency[0] || '';
      setGame(next);
      autoFillRake(venue, next);
    }
  }

  const editRake = (setter) => (e) => { setter(e.target.value); setRakeEdited(true); setRakeSource(''); };

  function applyPreset(s) {
    if (s.venue) setVenue(s.venue);
    if (s.game) setGame(s.game);
    if (s.currency) setCurrency(s.currency);
    if (s.totalSeats) setTotalSeats(s.totalSeats);
    applyRakeProfile({ rakeType: s.rakeType || 'percent', rake: s.rake, rakeMax: s.rakeMax || 0, jackpot: s.jackpot || 0 });
    setRakeEdited(false);
    setRakeSource(s.rake != null ? `${(s.venue || '').trim()} · ${(s.game || '').trim()}` : '');
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
      jackpot: jackpot !== '' ? Number(jackpot) : 0,
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
        <label className="form-label">Currency</label>
        <div className="pill-group">
          {currencyOrder.map(c => (
            <button
              key={c.code}
              className={'pill' + (currency === c.code ? ' selected' : '')}
              onClick={() => pickCurrency(c.code)}
              title={c.name}
            >
              {c.symbol} {c.code}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Venue (optional)</label>
        <OptionPicker
          options={venueOptions}
          value={venue}
          placeholder="e.g. Okada Manila"
          onChange={v => { setVenue(v); autoFillRake(v, game); }}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Game / Blinds</label>
        <OptionPicker
          options={gameOptions}
          value={game}
          placeholder={`e.g. NL ${currencySymbol(currency)}25/${currencySymbol(currency)}50`}
          onChange={g => { setGame(g); autoFillRake(venue, g); }}
        />
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
        {rakeSource && (
          <div className="text-muted text-xs mb-8">Filled from your last session at {rakeSource}</div>
        )}
        <div className="pill-group mb-8">
          <button className={'pill' + (rakeType === 'percent' ? ' selected' : '')} onClick={() => { setRakeType('percent'); setRakeEdited(true); setRakeSource(''); }}>% of pot</button>
          <button className={'pill' + (rakeType === 'flat' ? ' selected' : '')} onClick={() => { setRakeType('flat'); setRakeEdited(true); setRakeSource(''); }}>Flat per hand</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="number"
            className="form-input"
            placeholder={rakeType === 'percent' ? 'e.g. 5 (for 5%)' : 'e.g. 500 (fixed)'}
            value={rake}
            onChange={editRake(setRake)}
            inputMode="numeric"
            style={{ flex: 1 }}
          />
          {rakeType === 'percent' && (
            <input
              type="number"
              className="form-input"
              placeholder="Max cap"
              value={rakeMax}
              onChange={editRake(setRakeMax)}
              inputMode="numeric"
              style={{ width: 100 }}
            />
          )}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Jackpot per hand <span className="text-muted text-xs">(optional)</span></label>
        <input
          type="number"
          className="form-input"
          placeholder="e.g. 20 — taken from every pot that sees a flop"
          value={jackpot}
          onChange={editRake(setJackpot)}
          inputMode="numeric"
        />
        <div className="text-muted text-xs mt-4">No rake or jackpot when the hand ends before the flop.</div>
      </div>

      <div style={{ paddingBottom: 24 }}>
        <button className="btn btn-primary btn-full" onClick={handleStart}>
          Start Session
        </button>
      </div>
    </div>
  );
}
