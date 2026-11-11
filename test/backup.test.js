import { describe, it, expect } from 'vitest';
import { buildBackup, parseBackup, backupFileName, summarizeImport } from '../src/backup.js';

const data = {
  players: [{ id: 'p1', name: 'Shark' }],
  sessions: [{ id: 's1', venue: 'Okada' }],
  hands: [{ id: 'h1', sessionId: 's1' }, { id: 'd1', sessionId: 's1', incomplete: true }],
};

describe('buildBackup', () => {
  it('wraps all stores with app tag, version and timestamp', () => {
    const b = buildBackup(data, new Date('2026-11-11T04:00:00Z'));
    expect(b).toEqual({
      app: 'poker-tracker', version: 1, exportedAt: '2026-11-11T04:00:00.000Z',
      players: data.players, sessions: data.sessions, hands: data.hands,
    });
  });
});

describe('parseBackup', () => {
  it('round-trips a built backup', () => {
    const text = JSON.stringify(buildBackup(data, new Date('2026-11-11T04:00:00Z')));
    const r = parseBackup(text);
    expect(r.ok).toBe(true);
    expect(r.data.hands).toHaveLength(2);
  });
  it('rejects text that is not JSON', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, error: 'Not a valid JSON file' });
  });
  it('rejects JSON from another app', () => {
    expect(parseBackup(JSON.stringify({ app: 'other', version: 1, players: [], sessions: [], hands: [] })))
      .toEqual({ ok: false, error: 'Not a Poker Tracker backup' });
  });
  it('rejects a newer backup version', () => {
    expect(parseBackup(JSON.stringify({ app: 'poker-tracker', version: 2, players: [], sessions: [], hands: [] })))
      .toEqual({ ok: false, error: 'Backup is from a newer version of the app' });
  });
  it('rejects missing stores or records without an id', () => {
    expect(parseBackup(JSON.stringify({ app: 'poker-tracker', version: 1, players: [], sessions: [] })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'poker-tracker', version: 1, players: [], sessions: [{ venue: 'x' }], hands: [] })))
      .toEqual({ ok: false, error: 'Backup is damaged (sessions record without id)' });
  });
});

describe('backupFileName', () => {
  it('uses the local date', () => {
    expect(backupFileName(new Date(2026, 10, 11, 23, 30))).toBe('poker-tracker-backup-2026-11-11.json');
  });
});

describe('summarizeImport', () => {
  it('counts new vs overwritten records per store', () => {
    const existing = { players: ['p1'], sessions: [], hands: ['h1', 'h9'] };
    expect(summarizeImport(existing, data)).toEqual({
      players: { added: 0, updated: 1 },
      sessions: { added: 1, updated: 0 },
      hands: { added: 1, updated: 1 },
    });
  });
});
