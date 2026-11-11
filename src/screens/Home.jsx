import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSessionsSorted, getHandsBySession } from '../db';
import { formatMoney, sumNet, parseBB, parseSB } from '../utils';

export default function Home() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [handCounts, setHandCounts] = useState({});
  const [netResults, setNetResults] = useState({});

  useEffect(() => {
    async function load() {
      const s = await getSessionsSorted();
      setSessions(s);

      const counts = {};
      const nets = {};
      await Promise.all(s.map(async session => {
        const hands = await getHandsBySession(session.id);
        const real = hands.filter(h => !h.incomplete);
        counts[session.id] = real.length;
        nets[session.id] = sumNet(real, {
          sb: parseSB(session.game),
          bb: parseBB(session.game),
        });
      }));
      setHandCounts(counts);
      setNetResults(nets);
    }
    load();
  }, []);

  function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const net = Object.values(netResults).reduce((a, b) => a + b, 0);

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>🃏 Poker Tracker</h1>
        <div className="row gap-8">
          {sessions.length > 0 && (
            <span className={net >= 0 ? 'result-won' : 'result-lost'} style={{ fontSize: '1rem' }}>
              {formatMoney(net)}
            </span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/backup')}>Backup</button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">🎴</div>
          <p>No sessions yet</p>
          <p className="text-sm mt-8">Tap + to start your first session</p>
        </div>
      ) : (
        sessions.map(s => {
          const n = netResults[s.id] || 0;
          return (
            <div
              key={s.id}
              className="card"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/session/${s.id}`)}
            >
              <div className="row-between">
                <div>
                  <div style={{ fontWeight: 600 }}>{s.venue || 'Unnamed venue'}</div>
                  <div className="text-muted text-sm">{s.game} · {fmtDate(s.date)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className={n >= 0 ? 'result-won' : 'result-lost'}>{formatMoney(n)}</div>
                  <div className="text-muted text-xs">{handCounts[s.id] || 0} hands</div>
                </div>
              </div>
            </div>
          );
        })
      )}

      <button className="fab" onClick={() => navigate('/session/new')} title="New Session">
        +
      </button>
    </div>
  );
}
