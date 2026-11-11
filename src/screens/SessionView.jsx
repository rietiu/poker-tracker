import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { get, put, del, getHandsBySession } from '../db';
import { isRedCard, TAG_META, randomPlayerName, sumNet, handNet, parseBB, parseSB, currencySymbol, formatSigned, formatGame, applySeatEvent, ensureSeatCodes, describeSeatEvent } from '../utils';
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

// One seat at the table: who's there (code / nickname / tags / stack) and what
// happened (away, back, left, someone new, moved). I can move to an empty seat.
function SeatEditSheet({ seatNum, seat, isMySeat, session, sym, onSaveDetails, onEvent, onClose }) {
  const s = seat || {};
  const status = s.status || 'active';
  const [name, setName] = useState(s.name || '');
  const [stack, setStack] = useState(String(s.estimatedStack || ''));
  const [tags, setTags] = useState(s.tags || []);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const emptySeats = (session.seats || [])
    .filter(x => x.status === 'empty' && x.seatNum !== session.mySeat)
    .map(x => x.seatNum);

  function saveDetails() {
    onSaveDetails(seatNum, { name: name.trim(), tags, estimatedStack: stack ? Number(stack) : '' });
  }

  const moveMenu = (onPick) => (
    emptySeats.length === 0
      ? <div className="text-muted text-sm mb-8">No empty seat — mark a seat empty first.</div>
      : (
        <div className="seat-grid" style={{ marginBottom: 8 }}>
          {emptySeats.map(n => (
            <button key={n} className="seat-btn" onClick={() => onPick(n)}>{n}</button>
          ))}
        </div>
      )
  );

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>Seat {seatNum}{isMySeat ? ' (You)' : s.code ? ` · ${s.code}` : ''}</h2>
          <button className="back-btn" style={{ minHeight: 'auto', paddingRight: 0 }} onClick={onClose}>✕</button>
        </div>

        {isMySeat ? (
          <>
            <div className="form-group">
              <label className="form-label">Move to an empty seat</label>
              {moveMenu(n => onEvent({ type: 'heroMove', to: n }))}
            </div>
          </>
        ) : status === 'empty' ? (
          <>
            <div className="seat-status-banner left-banner">Empty seat — nobody sitting</div>
            <button className="btn btn-primary btn-full mb-8" onClick={() => onEvent({ type: 'seated', seat: seatNum })}>
              Someone sat down
            </button>
          </>
        ) : (
          <>
            {status === 'away' && <div className="seat-status-banner away-banner">Away from the table — not dealt in</div>}

            <div className="form-group">
              <label className="form-label">Nickname <span className="text-muted text-xs">(code {s.code})</span></label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  placeholder={`e.g. Korean, fast — or keep "${s.code}"`}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }} onClick={() => setName(randomPlayerName())} title="Random nickname">?</button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Est. Stack ({sym})</label>
              <input type="number" className="form-input" placeholder="0" value={stack} onChange={e => setStack(e.target.value)} inputMode="numeric" />
            </div>

            <div className="form-group">
              <label className="form-label">Tags</label>
              <TagSelector selected={tags} onChange={setTags} />
            </div>

            <button className="btn btn-primary btn-full mb-8" onClick={saveDetails}>Save</button>

            {status === 'away' ? (
              <button className="btn btn-secondary btn-full mb-8" onClick={() => onEvent({ type: 'back', seat: seatNum })}>Back at the table</button>
            ) : (
              <button className="btn btn-secondary btn-full mb-8" onClick={() => onEvent({ type: 'away', seat: seatNum })}>Away (bathroom, meal…)</button>
            )}
            <button className="btn btn-secondary btn-full mb-8" onClick={() => setShowMoveMenu(v => !v)}>Moved to another seat…</button>
            {showMoveMenu && moveMenu(n => onEvent({ type: 'move', from: seatNum, to: n }))}
            <button className="btn btn-secondary btn-full mb-8" style={{ color: 'var(--text2)' }} onClick={() => onEvent({ type: 'left', seat: seatNum })}>
              Left — seat is empty
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SeatGrid({ session, onSeatTap }) {
  const { seats = [], mySeat, totalSeats } = session;
  const sym = currencySymbol(session.currency);
  return (
    <div className="session-seat-grid">
      {Array.from({ length: totalSeats }, (_, i) => i + 1).map(n => {
        const seat = seats.find(s => s.seatNum === n) || {};
        const isMe = n === mySeat;
        const status = isMe ? 'active' : (seat.status || 'active');
        return (
          <button
            key={n}
            className={`session-seat-card${isMe ? ' ssc-me' : ''}${status === 'away' ? ' ssc-away' : ''}${status === 'empty' ? ' ssc-left' : ''}`}
            onClick={() => onSeatTap(n)}
          >
            <div className="ssc-num">#{n}</div>
            <div className="ssc-name">
              {isMe ? 'You' : status === 'empty' ? 'Empty' : (seat.name || seat.code || '—')}
            </div>
            {!isMe && status !== 'empty' && seat.name && seat.code && <div className="ssc-code">{seat.code}</div>}
            {status !== 'empty' && seat.estimatedStack ? (
              <div className="ssc-stack">{sym}{Number(seat.estimatedStack).toLocaleString()}</div>
            ) : null}
            {status !== 'empty' && (seat.tags || []).length > 0 && (
              <div className="ssc-tags">
                {seat.tags.map(t => (
                  <span key={t} className="ssc-tag-dot" style={{ background: TAG_META[t]?.color }} title={TAG_META[t]?.label} />
                ))}
              </div>
            )}
            {status === 'away' && <div className="ssc-left-pill ssc-away-pill">Away</div>}
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
      const raw = await get('sessions', id);
      // Older sessions: every seat present, occupied seats get a code (A, B, C…).
      const s = raw ? ensureSeatCodes(raw) : raw;
      if (raw && JSON.stringify(s.seats) !== JSON.stringify(raw.seats)) await put('sessions', s);
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

  async function saveSession(updated) {
    await put('sessions', updated);
    setSession(updated);
  }

  async function handleSaveDetails(seatNum, patch) {
    const seats = (session.seats || []).map(x => (x.seatNum === seatNum ? { ...x, ...patch } : x));
    await saveSession({ ...session, seats });
    setEditingSeat(null);
  }

  async function handleSeatEvent(event) {
    await saveSession(applySeatEvent(session, event));
    setEditingSeat(null);
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
    const n = handNet(hand, blinds);
    if (hand.result?.outcome === 'folded') return n < 0 ? `Fold −${Math.abs(n).toLocaleString()}` : 'Fold';
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
          <div className="text-muted text-sm">{formatGame(session.game, session.currency)} · {session.totalSeats}-handed</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className={netResult >= 0 ? 'result-won' : 'result-lost'}>{formatSigned(netResult, session.currency)}</div>
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
      {(session.seatLog || []).length > 0 && (
        <details className="seat-log">
          <summary>Table log ({session.seatLog.length})</summary>
          {[...session.seatLog].reverse().map((e, i) => (
            <div key={i} className="seat-log-row">
              <span className="text-muted">{new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span>{describeSeatEvent(e)}</span>
            </div>
          ))}
        </details>
      )}

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
            className="btn btn-primary flex-1"
            onClick={() => navigate(`/session/${id}/record`)}
          >
            + Record Hand
          </button>
        </div>
      </div>

      {editingSeat !== null && (
        <SeatEditSheet
          key={editingSeat}
          seatNum={editingSeat}
          seat={editingSeatData}
          isMySeat={editingSeat === session.mySeat}
          session={session}
          sym={currencySymbol(session.currency)}
          onSaveDetails={handleSaveDetails}
          onEvent={handleSeatEvent}
          onClose={() => setEditingSeat(null)}
        />
      )}
    </div>
  );
}
