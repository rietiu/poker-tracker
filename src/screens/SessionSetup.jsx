import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { put, getSessionsSorted } from '../db';
import { uuid, CURRENCIES, currencySymbol, recentValues, recentGames, buildGame, formatGame, sessionProfiles, profileSummary } from '../utils';
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
  const [game, setGame] = useState('');                 // a picked blind level (formatted)
  const [enteringNew, setEnteringNew] = useState(false); // "+ New" level: two blind boxes
  const [newBlinds, setNewBlinds] = useState({ type: 'NL', sb: '', bb: '', bbAuto: true });
  const [currency, setCurrency] = useState('PHP');
  const [totalSeats, setTotalSeats] = useState(6);
  const [mySeat, setMySeat] = useState(1);
  const [myStack, setMyStack] = useState('');
  const [rakeType, setRakeType] = useState('percent');
  const [rake, setRake] = useState('');
  const [rakeMax, setRakeMax] = useState('');
  const [jackpot, setJackpot] = useState('');
  const [rakeRoundUnit, setRakeRoundUnit] = useState('');     // '' = no rounding
  const [rakeRoundMode, setRakeRoundMode] = useState('nearest'); // 'nearest' | 'down'
  const [rakeEdited, setRakeEdited] = useState(false); // user typed rake fields → don't auto-fill over them
  const [rakeSource, setRakeSource] = useState('');    // e.g. "Okada · NL ₱25/₱50" when auto-filled
  const [allSessions, setAllSessions] = useState([]);
  const [profileKey, setProfileKey] = useState('');    // picked profile
  const [showDetails, setShowDetails] = useState(false); // profile picked → settings collapsed unless "Change"
  const [showAllProfiles, setShowAllProfiles] = useState(false);

  useEffect(() => {
    getSessionsSorted().then(all => {
      setAllSessions(all);
      // Start from whatever was played last (currency + stakes); first time → pesos.
      if (all[0]) {
        if (all[0].currency) setCurrency(all[0].currency);
        if (all[0].game) setGame(formatGame(all[0].game, all[0].currency || 'USD'));
      }
    });
  }, []);

  function applyRakeProfile(p) {
    setRakeType(p.rakeType);
    setRake(p.rake != null ? String(p.rake) : '');
    setRakeMax(p.rakeMax ? String(p.rakeMax) : '');
    setJackpot(p.jackpot ? String(p.jackpot) : '');
    setRakeRoundUnit(p.rakeRoundUnit ? String(p.rakeRoundUnit) : '');
    setRakeRoundMode(p.rakeRoundMode || 'nearest');
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
  const gameOptions = recentGames(allSessions, currency);
  const showNewBlinds = enteringNew || gameOptions.length === 0;
  const blindsFor = (b, code) => buildGame(b.type, b.sb, b.bb, code);
  // What gets saved: the picked level, or the two boxes formatted with the chosen currency symbol.
  const effectiveGame = showNewBlinds ? blindsFor(newBlinds, currency) : game;

  function updateNewBlinds(patch) {
    const next = { ...newBlinds, ...patch };
    if ('sb' in patch && next.bbAuto) next.bb = patch.sb === '' ? '' : String(Number(patch.sb) * 2);
    if ('bb' in patch) next.bbAuto = false;
    setNewBlinds(next);
    autoFillRake(venue, blindsFor(next, currency));
  }
  const usedCurrencies = recentValues(allSessions, 'currency');
  const currencyOrder = [
    ...usedCurrencies.map(code => CURRENCIES.find(c => c.code === code)).filter(Boolean),
    ...CURRENCIES.filter(c => !usedCurrencies.includes(c.code)),
  ];

  function pickCurrency(code) {
    setCurrency(code);
    // Keep the stakes only if they belong to this currency; else offer that currency's last stakes.
    if (enteringNew) { autoFillRake(venue, blindsFor(newBlinds, code)); return; }
    const forCurrency = recentGames(allSessions, code);
    if (!forCurrency.includes(game)) {
      const next = forCurrency[0] || '';
      setGame(next);
      autoFillRake(venue, next || blindsFor(newBlinds, code));
    }
  }

  const editRake = (setter) => (e) => { setter(e.target.value); setRakeEdited(true); setRakeSource(''); };

  // ── Profiles: every venue + level played, with its latest settings ─────────
  const profiles = sessionProfiles(allSessions);
  const visibleProfiles = showAllProfiles ? profiles : profiles.slice(0, 5);
  const selectedProfile = profiles.find(p => p.key === profileKey) || null;
  const collapsed = !!selectedProfile && !showDetails;

  function applyProfile(p) {
    setVenue(p.venue);
    setCurrency(p.currency);
    setGame(p.game);
    setEnteringNew(false);
    setTotalSeats(p.totalSeats);
    setMySeat(seat => Math.min(seat, p.totalSeats));
    applyRakeProfile(p);
    setRakeEdited(false);
    setRakeSource('');
    setProfileKey(p.key);
    setShowDetails(false);
  }

  function startNewProfile() {
    setProfileKey('');
    setShowDetails(true);
    setVenue('');
    setEnteringNew(true);
    setNewBlinds({ type: 'NL', sb: '', bb: '', bbAuto: true });
    applyRakeProfile({ rakeType: 'percent', rake: null, rakeMax: 0, jackpot: 0 });
    setRakeEdited(false);
    setRakeSource('');
  }

  async function handleStart() {
    // Every other seat starts occupied with a default code (A, B, C…); rename the
    // players worth remembering, mark seats away / empty from the session table.
    let codeIdx = 0;
    const seatArr = Array.from({ length: totalSeats }, (_, i) => ({
      seatNum: i + 1,
      code: i + 1 === mySeat ? '' : String.fromCharCode(65 + codeIdx++),
      name: '',
      playerId: null,
      tags: [],
      estimatedStack: '',
      status: 'active',
    }));

    const session = {
      id: uuid(),
      date: new Date().toISOString(),
      venue: venue.trim(),
      game: effectiveGame,
      currency,
      totalSeats,
      rakeType,
      rake: rake !== '' ? Number(rake) : null,
      rakeMax: rakeMax !== '' ? Number(rakeMax) : 0,
      jackpot: jackpot !== '' ? Number(jackpot) : 0,
      rakeRoundUnit: rakeRoundUnit !== '' ? Number(rakeRoundUnit) : 0,
      rakeRoundMode,
      myStack: Number(myStack) || 0,
      mySeat,
      seats: seatArr,
      seatLog: [],
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

      {profiles.length > 0 && (
        <div className="form-group">
          <label className="form-label">Pick a profile</label>
          <div className="profile-list">
            {visibleProfiles.map(p => (
              <button
                key={p.key}
                className={'profile-card' + (p.key === profileKey ? ' selected' : '')}
                onClick={() => (p.key === profileKey ? setProfileKey('') : applyProfile(p))}
              >
                <div className="profile-title">{p.venue || 'No venue'} · {p.game}</div>
                <div className="profile-meta">{profileSummary(p)}</div>
              </button>
            ))}
            {profiles.length > 5 && !showAllProfiles && (
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAllProfiles(true)}>Show all {profiles.length}</button>
            )}
            <button className={'profile-card profile-new' + (!profileKey && showDetails ? ' selected' : '')} onClick={startNewProfile}>
              + New place or level
            </button>
          </div>
        </div>
      )}

      {collapsed && (
        <div className="profile-picked mb-16">
          <div>
            <div className="profile-title">{selectedProfile.venue || 'No venue'} · {selectedProfile.game}</div>
            <div className="profile-meta">{profileSummary(selectedProfile)}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowDetails(true)}>Change</button>
        </div>
      )}

      {!collapsed && (<>

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
          onChange={v => { setVenue(v); autoFillRake(v, effectiveGame); }}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Game / Blinds</label>
        {gameOptions.length > 0 && (
          <div className="pill-group mb-8">
            {gameOptions.map(g => (
              <button
                key={g}
                className={'pill' + (!showNewBlinds && game === g ? ' selected' : '')}
                onClick={() => { setEnteringNew(false); setGame(g); autoFillRake(venue, g); }}
              >
                {g}
              </button>
            ))}
            <button
              className={'pill' + (showNewBlinds ? ' selected' : '')}
              onClick={() => { setEnteringNew(true); autoFillRake(venue, blindsFor(newBlinds, currency)); }}
            >
              + New
            </button>
          </div>
        )}
        {showNewBlinds && (
          <div className="blind-new">
            <div className="pill-group mb-8">
              {['NL', 'PLO'].map(t => (
                <button key={t} className={'pill' + (newBlinds.type === t ? ' selected' : '')} onClick={() => updateNewBlinds({ type: t })}>
                  {t}
                </button>
              ))}
            </div>
            <div className="blind-inputs">
              <label className="blind-box">
                <span className="blind-label">Small blind</span>
                <span className="blind-field">
                  <span className="blind-sym">{currencySymbol(currency)}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="form-input"
                    placeholder="25"
                    value={newBlinds.sb}
                    onChange={e => updateNewBlinds({ sb: e.target.value })}
                  />
                </span>
              </label>
              <span className="blind-slash">/</span>
              <label className="blind-box">
                <span className="blind-label">Big blind</span>
                <span className="blind-field">
                  <span className="blind-sym">{currencySymbol(currency)}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="form-input"
                    placeholder="50"
                    value={newBlinds.bb}
                    onChange={e => updateNewBlinds({ bb: e.target.value })}
                  />
                </span>
              </label>
            </div>
            <div className="text-muted text-xs mt-4">
              {effectiveGame ? `Saved as ${effectiveGame}` : 'Enter both blinds'}
            </div>
          </div>
        )}
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

      </>)}

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

      {!collapsed && (<>
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
        {rakeType === 'percent' && (
          <div className="rake-round mt-8">
            <span className="text-muted text-sm">Rounded</span>
            <div className="pill-group">
              {[['nearest', 'Nearest'], ['down', 'Down']].map(([m, label]) => (
                <button
                  key={m}
                  className={'pill pill-sm' + (rakeRoundMode === m ? ' selected' : '')}
                  onClick={() => { setRakeRoundMode(m); setRakeEdited(true); setRakeSource(''); }}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-muted text-sm">to</span>
            <input
              type="number"
              className="form-input"
              placeholder="1"
              value={rakeRoundUnit}
              onChange={editRake(setRakeRoundUnit)}
              inputMode="numeric"
              style={{ width: 80 }}
            />
          </div>
        )}
        {rakeType === 'percent' && (
          <div className="text-muted text-xs mt-4">
            {`e.g. 10% as ${currencySymbol(currency)}100 per full ${currencySymbol(currency)}1,000 → Down to 100 · 5% to the nearest ${currencySymbol(currency)}25 → Nearest to 25 · leave empty if unsure`}
          </div>
        )}
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

      </>)}

      <div style={{ paddingBottom: 24 }}>
        <button className="btn btn-primary btn-full" onClick={handleStart} disabled={!effectiveGame} style={{ opacity: effectiveGame ? 1 : 0.5 }}>
          Start Session
        </button>
      </div>
    </div>
  );
}
