import { describe, expect, it } from 'vitest';
import { formatRemaining } from './formatRemaining';

describe('formatRemaining', () => {
  it.each([
    [{ remainPercent: 40, remainingGrams: 400 }, '≈ 400 g · 40 %'],
    [{ remainPercent: 40, remainingGrams: null }, '40 %'],
    [{ remainPercent: null, remainingGrams: null }, '?'],
  ])('shouldFormat %j', (tray, expected) => {
    expect(formatRemaining(tray)).toBe(expected);
  });
});
