import { describe, it, expect } from 'vitest';
import { calcPosition, buttonSeatFor, TABLE_POSITIONS } from '../src/utils.js';

describe('buttonSeatFor — inverse of calcPosition', () => {
  for (const n of [6, 8, 9]) {
    it(`${n}-max: every position maps back to the button seat that produces it`, () => {
      for (const mySeat of [1, 4, n]) {
        for (const pos of TABLE_POSITIONS[n]) {
          const btn = buttonSeatFor(n, mySeat, pos);
          expect(btn).toBeGreaterThanOrEqual(1);
          expect(btn).toBeLessThanOrEqual(n);
          expect(calcPosition(n, mySeat, btn)).toBe(pos);
        }
      }
    });
  }
  it('examples (9-max, I sit in seat 4)', () => {
    expect(buttonSeatFor(9, 4, 'BTN')).toBe(4);
    expect(buttonSeatFor(9, 4, 'SB')).toBe(3);
    expect(buttonSeatFor(9, 4, 'BB')).toBe(2);
    expect(buttonSeatFor(9, 4, 'CO')).toBe(5);
  });
  it('unknown position or seat → null', () => {
    expect(buttonSeatFor(9, 4, '')).toBe(null);
    expect(buttonSeatFor(9, null, 'BTN')).toBe(null);
  });
});
