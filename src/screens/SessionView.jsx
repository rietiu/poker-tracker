import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { get, getAll, put, del, getHandsBySession } from '../db';
import { isRedCard, TAG_META, matchPlayers, toggleLook, describeLooks, uuid, randomPlayerName, sumNet, handNet, parseBB, parseSB, currencySymbol, formatSigned, formatGame, applySeatEvent, ensureSeatCodes, describeSeatEvent, clockOf } from '../utils';
import PositionBadge from '../components/PositionBadge';
import { TagSelector, LookSelector } from '../components/PlayerTag';

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
function SeatEditSheet({ seatNum, seat, isMySeat, session, sym, players = [], onSaveDetails, onEvent, onClose }) {
  const s = seat || {};
  const status = s.status || 'active';
  const [name, setName] = useState(s.name || '');
  const [stack, setStack] = useState(String(s.estimatedStack || ''));
  const [tags, setTags] = useState(s.tags || []);
  const [notes, setNotes] = useState(s.notes || '');
  const [looks, setLooks] = useState(s.looks || []);
  const [playerId, setPlayerId] = useState(s.playerId || '');
  const [remember, setRemember] = useState(true);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const linked = players.find(p => p.id === playerId);
  // Saved players already sitting elsewhere at this table aren't offered.
  const seatedIds = new Set((session.seats || []).filter(x => x.seatNum !== seatNum && x.playerId).map(x => x.playerId));
  const suggestions = linked ? [] : matchPlayers(players.filter(p => !seatedIds.has(p.id)), name, { looks });

  function pickPlayer(p) {
    setPlayerId(p.id);
    setName(p.name);
    setTags(p.tags || []);
    setNotes(p.notes || '');
    // Their saved looks, with what I picked just now taking precedence.
    setLooks(looks.reduce((acc, k) => (acc.includes(k) ? acc : toggleLook(acc, k)), p.looks || []));
  }

  function unlink() {
    setPlayerId('');
  }
  // Any other seat is a target; a taken one means its occupant left.
  const targets = (session.seats || [])
    .filter(x => x.seatNum !== session.mySeat && x.seatNum !== seatNum);

  function saveDetails() {
    onSaveDetails(
      seatNum,
      { name: name.trim(), tags, notes: notes.trim(), looks, playerId, estimatedStack: stack ? Number(stack) : '' },
      { remember: !playerId && remember && !!name.trim() },
    );
  }

  const moveMenu = (onPick) => (
    <>
      <div className="seat-grid" style={{ marginBottom: 4 }}>
        {targets.map(x => (
          <button
            key={x.seatNum}
            className={'seat-btn' + (x.status === 'empty' ? '' : ' seat-btn-taken')}
            onClick={() => onPick(x.seatNum)}
          >
            {x.seatNum}
            {x.status !== 'empty' && <span className="seat-btn-who">{x.name || x.code}</span>}
          </button>
        ))}
      </div>
      <div className="text-muted text-xs mb-8">Picking a taken seat marks its player as left.</div>
    </>
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
              <label className="form-label">Move to seat</label>
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
              <label className="form-label">外號 Nickname <span className="text-muted text-xs">(code {s.code})</span></label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  placeholder={`e.g. 大叔、Rolex — or keep "${s.code}"`}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }} onClick={() => setName(randomPlayerName())} title="Random nickname">?</button>
              </div>
              {linked && (
                <div className="known-player-linked">
                  <span>✓ Saved player — changes here update their profile</span>
                  <button className="btn btn-ghost btn-sm" onClick={unlink}>Unlink</button>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">外表 Looks</label>
              <LookSelector selected={looks} onChange={setLooks} />
              {suggestions.length > 0 && (
                <div className="known-player-list">
                  <div className="text-muted text-xs">Seen before?</div>
                  {suggestions.map(p => (
                    <button key={p.id} className="known-player-item" onClick={() => pickPlayer(p)}>
                      <span className="known-player-name">{p.name}</span>
                      {(p.tags || []).filter(t => TAG_META[t]).map(t => (
                        <span key={t} className="ssc-tag-mini" style={{ background: TAG_META[t].color }}>{TAG_META[t].short}</span>
                      ))}
                      {(p.looks || []).length > 0 && <span className="known-player-notes">{describeLooks(p.looks)}</span>}
                      {p.notes && <span className="known-player-notes">{p.notes}</span>}
                    </button>
                  ))}
                </div>
              )}
              {!linked && (name.trim() ? (
                <label className="known-player-remember">
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
                  Remember this player for future sessions
                </label>
              ) : looks.length > 0 && (
                <div className="known-player-remember">Give a nickname to remember this player.</div>
              ))}
            </div>

            <div className="form-group">
              <label className="form-label">Other notes</label>
              <input
                className="form-input"
                placeholder="e.g. 金鏈、成日食煙、跟朋友一齊嚟"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
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
                {seat.tags.filter(t => TAG_META[t]).map(t => (
                  <span key={t} className="ssc-tag-mini" style={{ background: TAG_META[t].color }} title={TAG_META[t].label}>
                    {TAG_META[t].short}
                  </span>
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
  const [players, setPlayers] = useState([]); // saved player profiles

  useEffect(() => { getAll('players').then(setPlayers); }, []);

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

  async function handleSaveDetails(seatNum, patch, { remember } = {}) {
    // Keep the saved player profile in step with what I record at the table.
    const now = new Date().toISOString();
    let player = null;
    if (patch.playerId) {
      const prev = players.find(p => p.id === patch.playerId);
      if (prev) player = { ...prev, name: patch.name || prev.name, tags: patch.tags, notes: patch.notes, looks: patch.looks, lastSeen: now };
    } else if (remember) {
      player = { id: uuid(), name: patch.name, tags: patch.tags, notes: patch.notes, looks: patch.looks, createdAt: now, lastSeen: now };
      patch = { ...patch, playerId: player.id };
    }
    if (player) {
      await put('players', player);
      setPlayers(prev => [...prev.filter(p => p.id !== player.id), player]);
    }
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
          <div className="text-muted text-sm">{formatGame(session.game, session.currency)} · {session.totalSeats}-handed · started {clockOf(session.date)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className={netResult >= 0 ? 'result-won' : 'result-lost'}>{formatSigned(netResult, session.currency)}</div>
          <div className="text-muted text-xs">{completedHands.length} recorded {completedHands.length === 1 ? 'hand' : 'hands'}</div>
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
                  {hand.playedAt && <span className="text-muted text-xs">{clockOf(hand.playedAt)}</span>}
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
          players={players}
          onSaveDetails={handleSaveDetails}
          onEvent={handleSeatEvent}
          onClose={() => setEditingSeat(null)}
        />
      )}
    </div>
  );
}
