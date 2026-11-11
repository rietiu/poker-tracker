import { describe, it, expect } from 'vitest';
import {
  TABLE_POSITIONS, PREFLOP_ACTION_ORDER, POSTFLOP_ACTION_ORDER,
  positionAmong, buttonSeatAmong, activeSeatNums, seatingAtHand, nextPlayerCode,
} from '../src/utils.js';

describe('positions for any number of players (2–9)', () => {
  it('one position per player', () => {
    for (let n = 2; n <= 9; n++) expect(TABLE_POSITIONS[n]).toHaveLength(n);
  });
  it('7-handed / 3-handed / heads-up orders', () => {
    expect(PREFLOP_ACTION_ORDER[7]).toEqual(['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
    expect(POSTFLOP_ACTION_ORDER[7]).toEqual(['SB', 'BB', 'UTG', 'LJ', 'HJ', 'CO', 'BTN']);
    expect(PREFLOP_ACTION_ORDER[3]).toEqual(['BTN', 'SB', 'BB']);
    expect(POSTFLOP_ACTION_ORDER[3]).toEqual(['SB', 'BB', 'BTN']);
    // heads-up: the button posts the small blind, acts first pre-flop and last after
    expect(PREFLOP_ACTION_ORDER[2]).toEqual(['SB', 'BB']);
    expect(POSTFLOP_ACTION_ORDER[2]).toEqual(['BB', 'SB']);
  });
  it('6/8/9-handed unchanged', () => {
    expect(TABLE_POSITIONS[6]).toEqual(['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN']);
    expect(PREFLOP_ACTION_ORDER[8]).toEqual(['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
    expect(PREFLOP_ACTION_ORDER[9]).toEqual(['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
  });
});

describe('positionAmong / buttonSeatAmong — only seated players count', () => {
  const active = [1, 3, 4, 5, 7, 8, 9]; // 9-max, seats 2 and 6 empty or away
  it('skips missing seats', () => {
    expect(positionAmong(active, 4, 1)).toBe('BB');  // 1 BTN, 3 SB, 4 BB
    expect(positionAmong(active, 9, 1)).toBe('CO');  // 7-handed: BTN SB BB UTG LJ HJ CO
    expect(positionAmong(active, 3, 1)).toBe('SB');
  });
  it('inverse: position → button seat', () => {
    for (const me of active) {
      for (const pos of TABLE_POSITIONS[7]) {
        const btn = buttonSeatAmong(active, me, pos);
        expect(active).toContain(btn);
        expect(positionAmong(active, me, btn)).toBe(pos);
      }
    }
  });
  it('button on an empty seat → no position', () => {
    expect(positionAmong(active, 4, 2)).toBe('');
  });
  it('heads-up', () => {
    expect(positionAmong([2, 5], 2, 2)).toBe('SB');
    expect(positionAmong([2, 5], 2, 5)).toBe('BB');
  });
});

describe('activeSeatNums', () => {
  it('away / empty / left seats are not dealt in; my seat always is', () => {
    const session = {
      totalSeats: 9, mySeat: 4,
      seats: [
        { seatNum: 2, status: 'empty' }, { seatNum: 6, status: 'away' }, { seatNum: 8, status: 'left' },
        { seatNum: 4, status: 'away' }, { seatNum: 5, status: 'active' },
      ],
    };
    expect(activeSeatNums(session)).toEqual([1, 3, 4, 5, 7, 9]);
  });
});

describe('seatingAtHand', () => {
  it('who sat where and in which position for this hand', () => {
    const seats = [
      { seatNum: 1, code: 'A' }, { seatNum: 3, code: 'B', name: 'Korean' }, { seatNum: 5, code: 'C' },
    ];
    expect(seatingAtHand(seats, [1, 3, 4, 5], 4, 1)).toEqual([
      { seat: 1, position: 'BTN', code: 'A', name: '' },
      { seat: 3, position: 'SB', code: 'B', name: 'Korean' },
      { seat: 4, position: 'BB', code: 'ME', name: 'Me' },
      { seat: 5, position: 'CO', code: 'C', name: '' },
    ]);
  });
});

describe('nextPlayerCode', () => {
  it('A, B, … Z, then AA', () => {
    expect(nextPlayerCode([])).toBe('A');
    expect(nextPlayerCode(['A', 'B', 'D'])).toBe('C');
    expect(nextPlayerCode('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''))).toBe('AA');
  });
});
