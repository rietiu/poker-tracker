import { describe, it, expect } from 'vitest';
import { matchPlayers, applySeatEvent, toggleLook, describeLooks, lookKeysIn } from '../src/utils.js';

const players = [
  { id: '1', name: 'Korean', notes: 'red cap', lastSeen: '2026-11-01T10:00:00Z' },
  { id: '2', name: 'Kid', notes: '', lastSeen: '2026-11-14T10:00:00Z' },
  { id: '3', name: 'Uncle', notes: 'korean watch, slow', lastSeen: '2026-11-15T10:00:00Z' },
];

describe('matchPlayers', () => {
  it('no query → no suggestions', () => {
    expect(matchPlayers(players, '')).toEqual([]);
    expect(matchPlayers(players, '  ')).toEqual([]);
  });
  it('matches nickname case-insensitively, recent first', () => {
    expect(matchPlayers(players, 'k').map(p => p.id)).toEqual(['2', '1', '3']);
  });
  it('nickname matches rank above notes matches', () => {
    expect(matchPlayers(players, 'korean').map(p => p.id)).toEqual(['1', '3']);
  });
  it('respects the limit', () => {
    expect(matchPlayers(players, 'k', { limit: 1 })).toHaveLength(1);
  });
});

describe('matchPlayers by looks', () => {
  const seen = [
    { id: 'a', name: 'Rolex', looks: ['kr', 'a40', 'male', 'glasses'], lastSeen: '2026-11-10T00:00:00Z' },
    { id: 'b', name: 'Auntie', looks: ['cn', 'a50', 'female', 'mask'], lastSeen: '2026-11-12T00:00:00Z' },
    { id: 'c', name: 'Kid', looks: ['kr', 'a20', 'male'], lastSeen: '2026-11-14T00:00:00Z' },
  ];
  it('looks alone find players without typing a nickname', () => {
    expect(matchPlayers(seen, '', { looks: ['kr'] }).map(p => p.id)).toEqual(['c', 'a']);
    expect(matchPlayers(seen, '', { looks: ['kr', 'glasses'] }).map(p => p.id)).toEqual(['a']);
  });
  it('looks and nickname combine', () => {
    expect(matchPlayers(seen, 'kid', { looks: ['kr'] }).map(p => p.id)).toEqual(['c']);
    expect(matchPlayers(seen, 'kid', { looks: ['cn'] })).toEqual([]);
  });
  it('面熟/面生 never filters', () => {
    expect(matchPlayers(seen, '', { looks: ['familiar'] })).toEqual([]);
    expect(matchPlayers(seen, '', { looks: ['familiar', 'female'] }).map(p => p.id)).toEqual(['b']);
  });
});

describe('looks helpers', () => {
  it('one choice per group, wear items combine', () => {
    expect(toggleLook(['kr', 'a40'], 'cn')).toEqual(['a40', 'cn']);
    expect(toggleLook(['glasses'], 'mask')).toEqual(['glasses', 'mask']);
    expect(toggleLook(['glasses', 'mask'], 'mask')).toEqual(['glasses']);
    expect(toggleLook(['rolex', 'glasses'], 'tattoo')).toEqual(['rolex', 'glasses', 'tattoo']);
    expect(lookKeysIn('traits')).toEqual(['rolex', 'tattoo', 'phone']);
    expect(lookKeysIn('wear')).toEqual(['glasses', 'cap', 'jacket', 'mask', 'headphones']);
  });
  it('describeLooks reads in a fixed order', () => {
    expect(describeLooks(['glasses', 'a40', 'kr'])).toBe('韓國 · 40幾 · 眼鏡');
    expect(describeLooks([])).toBe('');
  });
});

describe('seat events keep the saved-player link', () => {
  const at = '2026-11-15T07:00:00.000Z';
  const base = () => ({
    totalSeats: 3, mySeat: 3, seatLog: [],
    seats: [
      { seatNum: 1, code: 'A', name: 'Korean', tags: ['sticky'], notes: 'red cap', playerId: '1', status: 'active' },
      { seatNum: 2, code: '', name: '', tags: [], status: 'empty' },
      { seatNum: 3, code: '', name: '', tags: [], status: 'active' },
    ],
  });
  it('a move carries playerId and notes', () => {
    const s = applySeatEvent(base(), { type: 'move', from: 1, to: 2 }, at);
    expect(s.seats[1]).toMatchObject({ playerId: '1', notes: 'red cap', name: 'Korean' });
    expect(s.seats[0]).toMatchObject({ playerId: '', notes: '', status: 'empty' });
  });
  it('leaving clears the link', () => {
    const s = applySeatEvent(base(), { type: 'left', seat: 1 }, at);
    expect(s.seats[0]).toMatchObject({ playerId: '', notes: '' });
  });
});
