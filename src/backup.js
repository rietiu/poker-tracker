// Backup file format — pure helpers (no IndexedDB access here; see db.js).
//
// { app: 'poker-tracker', version: 1, exportedAt: ISO, players: [], sessions: [], hands: [] }

export const BACKUP_APP = 'poker-tracker';
export const BACKUP_VERSION = 1;
export const STORES = ['players', 'sessions', 'hands'];

export function buildBackup(data, now = new Date()) {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    players: data.players || [],
    sessions: data.sessions || [],
    hands: data.hands || [],
  };
}

// Validate a backup file's text. Returns { ok: true, data } or { ok: false, error }.
export function parseBackup(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Not a valid JSON file' };
  }
  if (!obj || obj.app !== BACKUP_APP) return { ok: false, error: 'Not a Poker Tracker backup' };
  if (typeof obj.version !== 'number' || obj.version > BACKUP_VERSION) {
    return { ok: false, error: 'Backup is from a newer version of the app' };
  }
  for (const store of STORES) {
    if (!Array.isArray(obj[store])) return { ok: false, error: `Backup is damaged (missing ${store})` };
    if (obj[store].some(r => !r || typeof r !== 'object' || !r.id)) {
      return { ok: false, error: `Backup is damaged (${store} record without id)` };
    }
  }
  return { ok: true, data: obj };
}

export function backupFileName(now = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `poker-tracker-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

// existingIds: { players: [id], sessions: [id], hands: [id] }
// Import upserts by id, so a record is either added or overwrites one with the same id.
export function summarizeImport(existingIds, backup) {
  const out = {};
  for (const store of STORES) {
    const have = new Set(existingIds[store] || []);
    const recs = backup[store] || [];
    const updated = recs.filter(r => have.has(r.id)).length;
    out[store] = { added: recs.length - updated, updated };
  }
  return out;
}
