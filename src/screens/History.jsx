import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllHandsSorted, getSessionsSorted } from '../db';
import { formatMoney, isRedCard } from '../utils';
import PositionBadge from '../components/PositionBadge';

function CardBadge({ card }) {
  if (!card) return null;
  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  const suitSym = suit === 'h' ? '♥' : suit === 'd' ? '♦' : suit === 's' ? '♠' : '♣';
  const red = suit === 'h' || suit === 'd';
  return (
    <span
      className={'card-display sm' + (red ? ' red' : '')}
      style={{ cursor: 'default', margin: '0 1px' }}
    >
      <span>{rank}</span>
      <span style={{ fontSize: '0.65em' }}>{suitSym}</span>
    </span>
  );
}

export default function History() {
  const navigate = useNavigate();
  const [hands, setHands] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [filterSession, setFilterSession] = useState('');
  const [filterResult, setFilterResult] = useState('all');
  const [filterPosition, setFilterPosition] = useState('');

  useEffect(() => {
    async function load() {
      const [h, s] = await Promise.all([getAllHandsSorted(), getSessionsSorted()]);
      setHands(h);
      setSessions(s);
    }
    load();
  }, []);

  const filtered = hands.filter(h => {
    if (filterSession && h.sessionId !== filterSession) return false;
    if (filterResult === 'won' && h.result?.outcome !== 'won') return false;
    if (filterResult === 'lost' && h.result?.outcome !== 'lost') return false;
    if (filterResult === 'folded' && h.result?.outcome !== 'folded') return false;
    if (filterPosition && h.myPosition !== filterPosition) return false;
    return true;
  });

  function sessionLabel(sid) {
    const s = sessions.find(s => s.id === sid);
    return s ? `${s.venue || 'Unnamed'} ${s.game}` : sid;
  }

  function resultText(hand) {
    const { outcome, amount } = hand.result || {};
    if (outcome === 'folded') return { text: 'Fold', cls: 'result-fold' };
    if (outcome === 'won') return { text: `+${Number(amount).toLocaleString()}`, cls: 'result-won' };
    if (outcome === 'lost') return { text: `-${Math.abs(Number(amount)).toLocaleString()}`, cls: 'result-lost' };
    if (outcome === 'split') return { text: `±${Number(amount).toLocaleString()}`, cls: 'result-split' };
    return { text: '—', cls: 'result-fold' };
  }

  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  const POSITIONS = ['BTN', 'CO', 'HJ', 'MP', 'EP', 'SB', 'BB'];

  const totalNet = filtered.reduce((sum, h) => {
    const { outcome, amount } = h.result || {};
    const amt = Number(amount) || 0;
    if (outcome === 'won' || outcome === 'split') return sum + amt;
    if (outcome === 'lost') return sum - Math.abs(amt);
    return sum;
  }, 0);

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>History</h1>
        {filtered.length > 0 && (
          <span className={totalNet >= 0 ? 'result-won' : 'result-lost'}>
            {formatMoney(totalNet)}
          </span>
        )}
      </div>

      {/* Filters */}
      <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', marginBottom: 12, paddingBottom: 4 }}>
        <div className="pill-group" style={{ display: 'inline-flex', flexWrap: 'nowrap' }}>
          <button
            className={'pill btn-sm' + (!filterSession ? ' selected' : '')}
            onClick={() => setFilterSession('')}
            style={{ minHeight: 36 }}
          >
            All sessions
          </button>
          {sessions.map(s => (
            <button
              key={s.id}
              className={'pill btn-sm' + (filterSession === s.id ? ' selected' : '')}
              onClick={() => setFilterSession(filterSession === s.id ? '' : s.id)}
              style={{ minHeight: 36 }}
            >
              {s.venue || 'Unnamed'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', marginBottom: 12, paddingBottom: 4 }}>
        <div className="pill-group" style={{ display: 'inline-flex', flexWrap: 'nowrap', gap: 6 }}>
          {['all', 'won', 'lost', 'folded'].map(r => (
            <button
              key={r}
              className={'pill btn-sm' + (filterResult === r ? ' selected' : '')}
              onClick={() => setFilterResult(r)}
              style={{ minHeight: 36 }}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
        <div className="pill-group" style={{ display: 'inline-flex', flexWrap: 'nowrap', gap: 6, marginLeft: 8 }}>
          <button
            className={'pill btn-sm' + (!filterPosition ? ' selected' : '')}
            onClick={() => setFilterPosition('')}
            style={{ minHeight: 36 }}
          >
            Any pos
          </button>
          {POSITIONS.map(p => (
            <button
              key={p}
              className={'pill btn-sm' + (filterPosition === p ? ' selected' : '')}
              onClick={() => setFilterPosition(filterPosition === p ? '' : p)}
              style={{ minHeight: 36 }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">🔍</div>
          <p>No hands match filters</p>
        </div>
      ) : (
        filtered.map(hand => {
          const res = resultText(hand);
          return (
            <div
              key={hand.id}
              className="card"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/hand/${hand.id}`)}
            >
              <div className="row-between">
                <div>
                  <div className="row gap-8">
                    <PositionBadge position={hand.myPosition} />
                    <span>{hand.holeCards?.map((c, i) => <CardBadge key={i} card={c} />)}</span>
                  </div>
                  <div className="text-muted text-xs mt-8">
                    {sessionLabel(hand.sessionId)} · #{hand.handNum} · {fmtDate(hand.createdAt)}
                  </div>
                </div>
                <span className={res.cls}>{res.text}</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
