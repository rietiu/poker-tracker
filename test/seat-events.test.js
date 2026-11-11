import { describe, it, expect } from 'vitest';
import { applySeatEvent, ensureSeatCodes, describeSeatEvent } from '../src/utils.js';

const at = '2026-11-11T13:05:00.000Z';
const base = () => ({
  totalSeats: 6, mySeat: 4, seatLog: [],
  seats: [
    { seatNum: 1, code: 'A', name: '', tags: [], status: 'active' },
    { seatNum: 2, code: 'B', name: 'Korean', tags: ['aggro'], estimatedStack: 8000, status: 'active' },
    { seatNum: 3, code: '', name: '', tags: [], status: 'empty' },
    { seatNum: 4, code: '', name: '', tags: [], status: 'active' },
    { seatNum: 5, code: 'C', name: '', tags: [], status: 'active' },
    { seatNum: 6, code: 'D', name: '', tags: [], status: 'active' },
  ],
});
const seat = (s, n) => s.seats.find(x => x.seatNum === n);

describe('applySeatEvent', () => {
  it('away and back keep the player in the seat', () => {
    const s1 = applySeatEvent(base(), { type: 'away', seat: 2 }, at);
    expect(seat(s1, 2)).toMatchObject({ status: 'away', code: 'B', name: 'Korean' });
    const s2 = applySeatEvent(s1, { type: 'back', seat: 2 }, at);
    expect(seat(s2, 2).status).toBe('active');
    expect(s2.seatLog.map(e => e.type)).toEqual(['away', 'back']);
  });
  it('player leaves → seat empty, player info cleared but kept in the log', () => {
    const s1 = applySeatEvent(base(), { type: 'left', seat: 2 }, at);
    expect(seat(s1, 2)).toMatchObject({ status: 'empty', code: '', name: '', tags: [] });
    expect(s1.seatLog[0]).toMatchObject({ type: 'left', seat: 2, code: 'B', name: 'Korean', at });
  });
  it('someone sits in an empty seat → next free code', () => {
    const s1 = applySeatEvent(base(), { type: 'seated', seat: 3 }, at);
    expect(seat(s1, 3)).toMatchObject({ status: 'active', code: 'E' });
  });
  it('a player changes seat: identity moves with them, old seat empty', () => {
    const s1 = applySeatEvent(base(), { type: 'move', from: 2, to: 3 }, at);
    expect(seat(s1, 3)).toMatchObject({ status: 'active', code: 'B', name: 'Korean', tags: ['aggro'], estimatedStack: 8000 });
    expect(seat(s1, 2)).toMatchObject({ status: 'empty', code: '', name: '' });
    expect(s1.seatLog[0]).toMatchObject({ type: 'move', from: 2, to: 3, code: 'B', name: 'Korean' });
  });
  it('I change seat: my old seat becomes empty', () => {
    const s1 = applySeatEvent(base(), { type: 'heroMove', to: 3 }, at);
    expect(s1.mySeat).toBe(3);
    expect(seat(s1, 3).status).toBe('active');
    expect(seat(s1, 4).status).toBe('empty');
    expect(s1.seatLog[0]).toMatchObject({ type: 'heroMove', from: 4, to: 3 });
  });
  it('moves only into an empty seat', () => {
    expect(() => applySeatEvent(base(), { type: 'move', from: 2, to: 5 }, at)).toThrow();
    expect(() => applySeatEvent(base(), { type: 'heroMove', to: 5 }, at)).toThrow();
  });
  it("a code is never reused in a session — a new player never gets a departed player's code", () => {
    const s1 = applySeatEvent(base(), { type: 'left', seat: 6 }, at);        // D leaves
    const s2 = applySeatEvent(s1, { type: 'seated', seat: 6 }, at);          // someone new sits
    expect(seat(s2, 6).code).toBe('E');
    const s3 = applySeatEvent(s2, { type: 'left', seat: 6 }, at);            // E leaves too
    const s4 = applySeatEvent(s3, { type: 'seated', seat: 3 }, at);
    expect(seat(s4, 3).code).toBe('F');
  });
  it('does not mutate the input', () => {
    const s0 = base();
    applySeatEvent(s0, { type: 'left', seat: 2 }, at);
    expect(seat(s0, 2).status).toBe('active');
  });
});

describe('ensureSeatCodes', () => {
  it('old sessions: every seat exists, occupied seats get codes, "left" becomes empty', () => {
    const s = ensureSeatCodes({
      totalSeats: 4, mySeat: 1,
      seats: [{ seatNum: 2, name: 'Shark' }, { seatNum: 3, status: 'left', name: 'x' }],
    });
    expect(s.seats.map(x => [x.seatNum, x.status, x.code])).toEqual([
      [1, 'active', ''], [2, 'active', 'A'], [3, 'empty', ''], [4, 'active', 'B'],
    ]);
    expect(s.seatLog).toEqual([]);
  });
});

describe('describeSeatEvent', () => {
  it('reads like a table log', () => {
    expect(describeSeatEvent({ type: 'move', from: 2, to: 3, code: 'B', name: 'Korean' })).toBe('Korean (B) moved seat 2 → 3');
    expect(describeSeatEvent({ type: 'heroMove', from: 4, to: 3 })).toBe('I moved seat 4 → 3');
    expect(describeSeatEvent({ type: 'away', seat: 5, code: 'C', name: '' })).toBe('C (seat 5) is away');
    expect(describeSeatEvent({ type: 'left', seat: 5, code: 'C', name: '' })).toBe('C left seat 5 — empty');
    expect(describeSeatEvent({ type: 'seated', seat: 3, code: 'E' })).toBe('New player E sat in seat 3');
    expect(describeSeatEvent({ type: 'back', seat: 5, code: 'C', name: '' })).toBe('C is back in seat 5');
  });
});
