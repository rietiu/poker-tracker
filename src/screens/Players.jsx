import { useState, useEffect } from 'react';
import { getAll, put, del, getSessionsSorted } from '../db';
import { uuid } from '../utils';
import PlayerTag from '../components/PlayerTag';
import { TagSelector } from '../components/PlayerTag';

function PlayerForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || '');
  const [tags, setTags] = useState(initial?.tags || []);
  const [notes, setNotes] = useState(initial?.notes || '');

  function handleSave() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), tags, notes });
  }

  return (
    <div className="card">
      <div className="form-group">
        <label className="form-label">Name *</label>
        <input
          type="text"
          className="form-input"
          placeholder="Player name"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
      </div>

      <div className="form-group">
        <label className="form-label">Tags</label>
        <TagSelector selected={tags} onChange={setTags} />
      </div>

      <div className="form-group">
        <label className="form-label">Notes (optional)</label>
        <input
          type="text"
          className="form-input"
          placeholder="e.g. plays tight preflop"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      <div className="row gap-8">
        <button className="btn btn-secondary flex-1" onClick={onCancel}>Cancel</button>
        <button
          className="btn btn-primary flex-1"
          onClick={handleSave}
          disabled={!name.trim()}
          style={{ opacity: name.trim() ? 1 : 0.5 }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

// Inline seat tag editor — expands in-place
function SeatTagRow({ sessionLabel, seat, onSave }) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState(seat.tags || []);

  function handleSave() {
    onSave(seat.seatNum, tags);
    setOpen(false);
  }

  return (
    <div className="card" style={{ marginBottom: 8 }}>
      <div className="row-between" style={{ cursor: 'pointer' }} onClick={() => setOpen(v => !v)}>
        <div>
          <div className="text-sm text-muted" style={{ marginBottom: 2 }}>{sessionLabel} · Seat {seat.seatNum}</div>
          <div style={{ fontWeight: 600 }}>{seat.name || <span className="text-muted">Anonymous</span>}</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
            {(seat.tags || []).map(t => <PlayerTag key={t} tag={t} />)}
          </div>
        </div>
        <span className="text-muted text-sm" style={{ flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <TagSelector selected={tags} onChange={setTags} />
          <div className="row gap-8" style={{ marginTop: 10 }}>
            <button className="btn btn-secondary flex-1" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary flex-1" onClick={handleSave}>Save Tags</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Players() {
  const [players, setPlayers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [view, setView] = useState('players'); // 'players' | 'seats'

  async function load() {
    const all = await getAll('players');
    setPlayers(all.sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function loadSessions() {
    const all = await getSessionsSorted();
    setSessions(all);
  }

  useEffect(() => { load(); loadSessions(); }, []);

  const filtered = players.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  // Collect all seats from all sessions that have a name or tags
  const seatEntries = sessions.flatMap(s =>
    (s.seats || [])
      .filter(seat => (seat.tags || []).length > 0 || seat.name)
      .map(seat => ({ session: s, seat }))
  );

  const filteredSeats = seatEntries.filter(({ session, seat }) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (seat.name || '').toLowerCase().includes(q) ||
      (session.venue || '').toLowerCase().includes(q) ||
      (session.game || '').toLowerCase().includes(q)
    );
  });

  async function handleAdd(data) {
    await put('players', { id: uuid(), ...data, createdAt: new Date().toISOString() });
    setAdding(false);
    load();
  }

  async function handleEdit(data) {
    await put('players', { ...editing, ...data });
    setEditing(null);
    load();
  }

  async function handleDelete(id) {
    await del('players', id);
    setConfirmDelete(null);
    load();
  }

  async function handleSeatTagSave(session, seatNum, tags) {
    const updatedSeats = (session.seats || []).map(s =>
      s.seatNum === seatNum ? { ...s, tags } : s
    );
    const updated = { ...session, seats: updatedSeats };
    await put('sessions', updated);
    setSessions(prev => prev.map(s => s.id === session.id ? updated : s));
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Players</h1>
        {view === 'players' && (
          <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>+ Add</button>
        )}
      </div>

      {/* View toggle */}
      <div className="pill-group mb-12">
        <button className={'pill' + (view === 'players' ? ' selected' : '')} onClick={() => setView('players')}>
          Saved
        </button>
        <button className={'pill' + (view === 'seats' ? ' selected' : '')} onClick={() => setView('seats')}>
          Table Seats
        </button>
      </div>

      {adding && (
        <PlayerForm
          onSave={handleAdd}
          onCancel={() => setAdding(false)}
        />
      )}

      <input
        type="text"
        className="search-input"
        placeholder={view === 'players' ? 'Search players…' : 'Search by name or venue…'}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {view === 'players' ? (
        filtered.length === 0 ? (
          <div className="empty-state">
            <div className="emoji">👤</div>
            <p>{search ? 'No players found' : 'No players yet'}</p>
            {!search && <p className="text-sm mt-8">Tap + Add to create a player profile</p>}
          </div>
        ) : (
          filtered.map(player => {
            if (editing?.id === player.id) {
              return (
                <PlayerForm
                  key={player.id}
                  initial={player}
                  onSave={handleEdit}
                  onCancel={() => setEditing(null)}
                />
              );
            }
            return (
              <div key={player.id} className="card">
                <div className="row-between">
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{player.name}</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(player.tags || []).map(t => <PlayerTag key={t} tag={t} />)}
                    </div>
                    {player.notes && (
                      <div className="text-muted text-xs mt-8">{player.notes}</div>
                    )}
                  </div>
                  <div className="row gap-8">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(player)}>Edit</button>
                    <button
                      className="btn btn-sm"
                      style={{ color: 'var(--red-light)', background: 'none' }}
                      onClick={() => setConfirmDelete(player)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )
      ) : (
        filteredSeats.length === 0 ? (
          <div className="empty-state">
            <div className="emoji">🪑</div>
            <p>{search ? 'No seats found' : 'No tagged seats yet'}</p>
            {!search && <p className="text-sm mt-8">Tag players from a session to see them here</p>}
          </div>
        ) : (
          filteredSeats.map(({ session, seat }) => (
            <SeatTagRow
              key={`${session.id}-${seat.seatNum}`}
              sessionLabel={session.venue || session.game || 'Session'}
              seat={seat}
              onSave={(seatNum, tags) => handleSeatTagSave(session, seatNum, tags)}
            />
          ))
        )
      )}

      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 300, padding: 24,
        }}>
          <div className="card" style={{ maxWidth: 320, width: '100%', textAlign: 'center' }}>
            <h2 className="mb-8">Delete {confirmDelete.name}?</h2>
            <p className="text-muted text-sm mb-16">This cannot be undone.</p>
            <div className="row gap-8">
              <button className="btn btn-secondary flex-1" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-danger flex-1" onClick={() => handleDelete(confirmDelete.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
