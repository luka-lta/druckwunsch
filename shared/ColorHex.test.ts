import { describe, expect, it } from 'vitest';
import { parseColorHex, toColorName, type ColorHex } from './ColorHex';

describe('parseColorHex', () => {
  it.each([
    ['#ae835b', '#AE835B'],
    ['AE835B', '#AE835B'],
    ['  #00ae42 ', '#00AE42'],
  ])('shouldNormalize %j', (input, expected) => {
    expect(parseColorHex(input)).toBe(expected);
  });

  it.each([[''], ['#fff'], ['#GGGGGG'], ['#AE835BFF'], ['rot'], [null], [42]])('shouldReject %j', (input) => {
    expect(parseColorHex(input)).toBeNull();
  });
});

describe('toColorName', () => {
  it.each([
    ['#000000', 'Schwarz'],
    ['#161616', 'Schwarz'],
    ['#FFFFFF', 'Weiß'],
    ['#F7F5F0', 'Weiß'],
    ['#9CA3AF', 'Grau'],
    ['#4B4B4B', 'Dunkelgrau'],
    ['#EF4444', 'Rot'],
    ['#F97316', 'Orange'],
    ['#FACC15', 'Gelb'],
    ['#00AE42', 'Grün'],
    ['#06B6D4', 'Türkis'],
    ['#3B82F6', 'Blau'],
    ['#7C3AED', 'Lila'],
    ['#EC4899', 'Pink'],
    ['#AE835B', 'Braun'],
    ['#6B3E1F', 'Braun'],
    ['#E8D9B5', 'Beige'],
    ['#F9A8B4', 'Rosa'],
  ])('shouldName %s as %s', (colorHex, expected) => {
    expect(toColorName(colorHex as ColorHex)).toBe(expected);
  });
});
