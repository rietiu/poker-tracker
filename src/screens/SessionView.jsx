import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { get, put, del, getHandsBySession } from '../db';
import { formatMoney, isRedCard, TAG_META, randomPlayerName, sumNet, handNet, parseBB, parseSB } from '../utils';
import PositionBadge from '../components/PositionBadge';
import { TagSelector } from '../components/PlayerTag';

function CardBadge({ card }) {
  if (!card) return null;
  return (
    <span
      className={'card-display sm' + (isRedCard(card) ? ' red' : '')}
      style={{ cursor: 'default', margin: '0 1px' }}
    >
      <span>{card.slice(0, -1)}</span>
      <span style={{ fontSize: '0.65em' }}>
        {card.slice(-1) === 'h' ? '♥' : card.slice(-1) === 'd' ? '♦' : card.slice(-1) === 's' ? '♠' : '♣'}
      </span>
    </span>
  );
}

function SeatEditSheet({ seatNum, seat, isMySeat, totalSeats, onSave, onMovePlayer, onMoveMySeat, onClose }) {
  const s = seat || {};
  const isLeft = s.status === 'left';

  const [name, setName] = useState(s.name || '');
  const [stack, setStack] = useState(String(s.estimatedStack || ''));
  const [tags, setTags] = useState(s.tags || []);
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  function save(patch = {}) {
    onSave(seatNum, { name: name.trim(), tags, estimatedStack: stack ? Number(stack) : '', status: 'active', ...patch });
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>Seat {seatNum}{isMySeat ? ' (You)' : ''}</h2>
          <button className="back-btn" style={{ minHeight: 'auto', paddingRight: 0 }} onClick={onClose}>✕</button>
        </div>

        {isLeft && (
          <div className="seat-status-banner left-banner">Player has left the table</div>
        )}

        {!isMySeat && (
          <div className="form-group">
            <label className="form-label">Nickname</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                placeholder="Name (optional)"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-secondary btn-sm"
                style={{ flexShrink: 0 }}
                onClick={() => setName(randomPlayerName())}
                title="Random nickname"
              >?</button>
            </div>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Est. Stack ($)</label>
          <input
            type="number"
            className="form-input"
            placeholder="0"
            value={stack}
            onChange={e => setStack(e.target.value)}
            inputMode="numeric"
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {[-500, -200, +200, +500].map(d => (
              <button
                key={d}
                className="quick-add-btn"
                style={{ flex: 1 }}
                onClick={() => setStack(String(Math.max(0, (Number(stack) || 0) + d)))}
              >
                {d > 0 ? '+' : ''}{d}
              </button>
            ))}
          </div>
        </div>

        {!isMySeat && (
          <div className="form-group">
            <label className="form-label">Tags</label>
            <TagSelector selected={tags} onChange={setTags} />
          </div>
        )}

        <button className="btn btn-primary btn-full mb-8" onClick={() => save()}>
          Save Changes
        </button>

        {!isMySeat && !isLeft && (
          <button className="btn btn-secondary btn-full mb-8" onClick={() => save({ status: 'left' })}>
            Player Left
          </button>
        )}

        {!isMySeat && isLeft && (
          <button className="btn btn-secondary btn-full mb-8" onClick={() => save({ status: 'active' })}>
            Re-entry (same seat)
          </button>
        )}

        {!isMySeat && (
          <>
            <button
              className="btn btn-secondary btn-full mb-8"
              onClick={() => setShowMoveMenu(v => !v)}
            >
              Move player to seat…
            </button>
            {showMoveMenu && (
              <div className="seat-grid" style={{ marginBottom: 8 }}>
                {Array.from({ length: totalSeats }, (_, i) => i + 1)
                  .filter(n => n !== seatNum)
                  .map(n => (
                    <button
                      key={n}
                      className="seat-btn"
                      onClick={() => { onMovePlayer(seatNum, n); onClose(); }}
                    >
                      {n}
                    </button>
                  ))}
              </div>
            )}
            <button
              className="btn btn-secondary btn-full mb-8"
              style={{ color: 'var(--text2)' }}
              onClick={() => save({ name: '', tags: [], estimatedStack: '', status: 'active' })}
            >
              Clear Seat
            </button>
          </>
        )}

        {isMySeat && (
          <div className="form-group">
            <label className="form-label">Move my seat to</label>
            <div className="seat-grid">
              {Array.from({ length: totalSeats }, (_, i) => i + 1)
                .filter(n => n !== seatNum)
                .map(n => (
                  <button
                    key={n}
                    className="seat-btn"
                    onClick={() => { onMoveMySeat(n); onClose(); }}
                  >
                    {n}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SeatGrid({ session, onSeatTap }) {
  const { seats = [], mySeat, totalSeats } = session;
  return (
    <div className="session-seat-grid">
      {Array.from({ length: totalSeats }, (_, i) => i + 1).map(n => {
        const seat = seats.find(s => s.seatNum === n) || {};
        const isMe = n === mySeat;
        const isLeft = seat.status === 'left';
        const hasData = isMe || seat.name || seat.estimatedStack || (seat.tags || []).length > 0;

        return (
          <button
            key={n}
            className={`session-seat-card${isMe ? ' ssc-me' : ''}${isLeft ? ' ssc-left' : ''}${!hasData ? ' ssc-empty' : ''}`}
            onClick={() => onSeatTap(n)}
          >
            <div className="ssc-num">#{n}</div>
            <div className="ssc-name">
              {isMe ? 'You' : (seat.name || '—')}
            </div>
            {seat.estimatedStack ? (
              <div className="ssc-stack">${Number(seat.estimatedStack).toLocaleString()}</div>
            ) : null}
            {(seat.tags || []).length > 0 && (
              <div className="ssc-tags">
                {seat.tags.map(t => (
                  <span
                    key={t}
                    className="ssc-tag-dot"
                    style={{ background: TAG_META[t]?.color }}
                    title={TAG_META[t]?.label}
                  />
                ))}
              </div>
            )}
            {isLeft && <div className="ssc-left-pill">Left</div>}
          </button>
        );
      })}
    </div>
  );
}

export default function SessionView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [hands, setHands] = useState([]);
  const [editingSeat, setEditingSeat] = useState(null); // seatNum or null

  useEffect(() => {
    async function load() {
      const s = await get('sessions', id);
      setSession(s);
      const h = await getHandsBySession(id);
      setHands(h.sort((a, b) => (a.handNum || 0) - (b.handNum || 0)));
    }
    load();
  }, [id]);

  async function discardDraft(draftId) {
    await del('hands', draftId);
    setHands(prev => prev.filter(h => h.id !== draftId));
  }

  async function handleSeatSave(seatNum, patch) {
    const existing = session.seats || [];
    let found = false;
    const updatedSeats = existing.map(s => {
      if (s.seatNum === seatNum) { found = true; return { ...s, ...patch }; }
      return s;
    });
    if (!found) updatedSeats.push({ seatNum, ...patch });
    const updated = { ...session, seats: updatedSeats };
    await put('sessions', updated);
    setSession(updated);
    setEditingSeat(null);
  }

  async function handleMovePlayer(fromSeat, toSeat) {
    const existing = session.seats || [];
    const fromData = existing.find(s => s.seatNum === fromSeat) || {};
    const blank = { name: '', tags: [], estimatedStack: '', status: 'active' };
    let toFound = false, fromFound = false;
    const updatedSeats = existing.map(s => {
      if (s.seatNum === fromSeat) { fromFound = true; return { ...s, ...blank }; }
      if (s.seatNum === toSeat) { toFound = true; return { ...s, name: fromData.name || '', tags: fromData.tags || [], estimatedStack: fromData.estimatedStack || '', status: 'active' }; }
      return s;
    });
    if (!fromFound) updatedSeats.push({ seatNum: fromSeat, ...blank });
    if (!toFound) updatedSeats.push({ seatNum: toSeat, name: fromData.name || '', tags: fromData.tags || [], estimatedStack: fromData.estimatedStack || '', status: 'active' });
    const updated = { ...session, seats: updatedSeats };
    await put('sessions', updated);
    setSession(updated);
  }

  async function handleMoveMySeat(toSeat) {
    const updated = { ...session, mySeat: toSeat };
    await put('sessions', updated);
    setSession(updated);
  }

  if (!session) return <div className="screen"><div className="text-muted">Loading…</div></div>;

  const completedHands = hands.filter(h => !h.incomplete);

  const blinds = { sb: parseSB(session.game), bb: parseBB(session.game) };
  const netResult = sumNet(completedHands, blinds);

  function resultClass(hand) {
    if (hand.result?.outcome === 'folded') return 'result-fold';
    return handNet(hand, blinds) >= 0 ? 'result-won' : 'result-lost';
  }

  function resultText(hand) {
    if (hand.result?.outcome === 'folded') return 'Fold';
    const n = handNet(hand, blinds);
    return (n >= 0 ? '+' : '−') + Math.abs(n).toLocaleString();
  }

  const editingSeatData = editingSeat !== null
    ? (session.seats || []).find(s => s.seatNum === editingSeat) || {}
    : null;

  return (
    <div className="screen" style={{ paddingBottom: 'calc(var(--nav-height) + 80px)' }}>
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
        <div style={{ flex: 1 }}>
          <h1>{session.venue || 'Unnamed venue'}</h1>
          <div className="text-muted text-sm">{session.game} · {session.totalSeats}-handed</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className={netResult >= 0 ? 'result-won' : 'result-lost'}>{formatMoney(netResult)}</div>
          <div className="text-muted text-xs">{completedHands.length} hands</div>
        </div>
      </div>

      {/* Draft banners — one per incomplete hand */}
      {hands.filter(h => h.incomplete).map(draft => (
        <div key={draft.id} className="draft-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span>Unfinished hand</span>
            {draft.myPosition && <span className="text-muted text-sm">· {draft.myPosition}</span>}
            {(draft.holeCards || []).filter(Boolean).map((c, i) => (
              <CardBadge key={i} card={c} />
            ))}
            {draft.draftState?.step != null && (
              <span className="text-muted text-sm">step {draft.draftState.step + 1}/7</span>
            )}
          </div>
          <div className="draft-banner-btns">
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/session/${id}/record/${draft.id}`)}>
              Continue
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => discardDraft(draft.id)}>
              Discard
            </button>
          </div>
        </div>
      ))}

      {/* Live table — tap any seat to edit */}
      <div className="section-label">Table</div>
      <SeatGrid session={session} onSeatTap={setEditingSeat} />

      <div className="divider" />

      {completedHands.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">&#x1F0A0;</div>
          <p>No hands recorded yet</p>
        </div>
      ) : (
        <>
          <div className="section-label">Recorded Hands</div>
          {completedHands.map(hand => (
            <div
              key={hand.id}
              className="card"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/hand/${hand.id}`)}
            >
              <div className="row-between">
                <div className="row gap-8">
                  <span className="text-muted text-sm">#{hand.handNum}</span>
                  {hand.quick && <span className="quick-badge">Q</span>}
                  <PositionBadge position={hand.myPosition} />
                  <span>
                    {hand.holeCards?.map((c, i) => <CardBadge key={i} card={c} />)}
                  </span>
                </div>
                <div className="row gap-8">
                  <span className={resultClass(hand)}>
                    {resultText(hand)}
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                    onClick={e => { e.stopPropagation(); navigate(`/hand/${hand.id}/edit`); }}
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      <div className="sticky-bottom">
        <div className="row gap-8">
          <button
            className="btn btn-secondary flex-1"
            onClick={() => navigate(`/session/${id}/quick`)}
          >
            Quick
          </button>
          <button
            className="btn btn-primary flex-1"
            onClick={() => navigate(`/session/${id}/record`)}
          >
            + Record Hand
          </button>
        </div>
      </div>

      {editingSeat !== null && (
        <SeatEditSheet
          seatNum={editingSeat}
          seat={editingSeatData}
          isMySeat={editingSeat === session.mySeat}
          totalSeats={session.totalSeats}
          onSave={handleSeatSave}
          onMovePlayer={handleMovePlayer}
          onMoveMySeat={handleMoveMySeat}
          onClose={() => setEditingSeat(null)}
        />
      )}
    </div>
  );
}
