import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { exportAllData, getAllIds, importBackup } from '../db';
import { buildBackup, parseBackup, backupFileName, summarizeImport, STORES } from '../backup';

const LAST_BACKUP_KEY = 'poker-tracker:lastBackupAt';

function readLastBackup() {
  try { return localStorage.getItem(LAST_BACKUP_KEY); } catch { return null; }
}

function fmtCount(c) {
  return `${c.players} players · ${c.sessions} sessions · ${c.hands} hands`;
}

export default function Backup() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState(null);
  const [lastBackup, setLastBackup] = useState(readLastBackup);
  const [pending, setPending] = useState(null);   // { data, summary, fileName }
  const [message, setMessage] = useState(null);   // { kind: 'ok' | 'error', text }
  const [busy, setBusy] = useState(false);

  async function refreshCounts() {
    const ids = await getAllIds();
    setCounts({ players: ids.players.length, sessions: ids.sessions.length, hands: ids.hands.length });
  }

  useEffect(() => {
    getAllIds().then(ids =>
      setCounts({ players: ids.players.length, sessions: ids.sessions.length, hands: ids.hands.length }));
  }, []);

  async function handleExport() {
    setMessage(null);
    const data = await exportAllData();
    const now = new Date();
    const blob = new Blob([JSON.stringify(buildBackup(data, now), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFileName(now);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    try { localStorage.setItem(LAST_BACKUP_KEY, now.toISOString()); } catch { /* storage unavailable */ }
    setLastBackup(now.toISOString());
    setMessage({ kind: 'ok', text: `Saved ${a.download}` });
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;
    setMessage(null);
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) {
      setPending(null);
      setMessage({ kind: 'error', text: parsed.error });
      return;
    }
    const summary = summarizeImport(await getAllIds(), parsed.data);
    setPending({ data: parsed.data, summary, fileName: file.name });
  }

  async function confirmImport() {
    setBusy(true);
    try {
      await importBackup(pending.data);
      const total = STORES.reduce((n, s) => n + pending.data[s].length, 0);
      setMessage({ kind: 'ok', text: `Imported ${total} records from ${pending.fileName}` });
      setPending(null);
      await refreshCounts();
    } catch (err) {
      setMessage({ kind: 'error', text: `Import failed — nothing was changed (${err.message})` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
        <h1>Backup</h1>
      </div>

      <div className="card mb-16">
        <div className="text-muted text-sm mb-8">On this device</div>
        <div>{counts ? fmtCount(counts) : 'Loading…'}</div>
        <div className="text-muted text-xs mt-8">
          {lastBackup
            ? `Last exported ${new Date(lastBackup).toLocaleString()}`
            : 'Never exported from this device'}
        </div>
      </div>

      <div className="card mb-16">
        <div style={{ fontWeight: 600 }} className="mb-8">Export</div>
        <div className="text-muted text-sm mb-12">
          Data lives only in this browser. Clearing site data or losing the phone loses it — export a copy regularly.
        </div>
        <button className="btn btn-primary btn-full" onClick={handleExport}>Export backup file</button>
      </div>

      <div className="card mb-16">
        <div style={{ fontWeight: 600 }} className="mb-8">Import</div>
        <div className="text-muted text-sm mb-12">
          Merges a backup into this device. Records with the same ID are replaced; nothing is deleted.
        </div>
        <label className="btn btn-secondary btn-full" style={{ cursor: 'pointer' }}>
          Choose backup file…
          <input type="file" accept="application/json,.json" onChange={handleFile} style={{ display: 'none' }} />
        </label>

        {pending && (
          <div className="backup-confirm mt-12">
            <div className="text-sm mb-8">{pending.fileName}</div>
            {STORES.map(s => (
              <div key={s} className="row-between text-sm">
                <span>{s}</span>
                <span className="text-muted">
                  +{pending.summary[s].added} new · {pending.summary[s].updated} replaced
                </span>
              </div>
            ))}
            <div className="row gap-8 mt-12">
              <button className="btn btn-secondary flex-1" onClick={() => setPending(null)} disabled={busy}>Cancel</button>
              <button className="btn btn-primary flex-1" onClick={confirmImport} disabled={busy}>
                {busy ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        )}
      </div>

      {message && (
        <div className={'backup-message ' + (message.kind === 'ok' ? 'result-won' : 'result-lost')}>
          {message.text}
        </div>
      )}
    </div>
  );
}
