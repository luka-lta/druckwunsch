/** Farbe im Format "#RRGGBB" mit Großbuchstaben */
export type ColorHex = string & { readonly __brand: 'ColorHex' };

const COLOR_HEX_PATTERN = /^#?([0-9a-f]{6})$/i;

/** Akzeptiert "#rrggbb" und "rrggbb" und normalisiert auf "#RRGGBB" */
export function parseColorHex(value: unknown): ColorHex | null {
  if (typeof value !== 'string') return null;
  const match = COLOR_HEX_PATTERN.exec(value.trim());
  if (match === null) return null;
  return `#${(match[1] ?? '').toUpperCase()}` as ColorHex;
}

interface Hsl {
  hue: number;
  saturation: number;
  lightness: number;
}

/** Leitet einen deutschen Farbnamen aus dem Farbcode ab, z.B. "#00AE42" → "Grün" */
export function toColorName(colorHex: ColorHex): string {
  const { hue, saturation, lightness } = toHsl(colorHex);

  if (lightness < 0.12) return 'Schwarz';
  if (lightness > 0.93) return 'Weiß';
  if (saturation < 0.12) return lightness < 0.45 ? 'Dunkelgrau' : 'Grau';

  // Gedeckte Orange-/Gelbtöne wirken als Braun bzw. Beige
  const isWarm = hue >= 15 && hue < 50;
  if (isWarm && lightness < 0.4) return 'Braun';
  if (isWarm && saturation < 0.45) return lightness < 0.6 ? 'Braun' : 'Beige';
  if (isWarm && lightness > 0.75 && saturation < 0.7) return 'Beige';

  if (hue < 15 || hue >= 345) return lightness > 0.75 ? 'Rosa' : 'Rot';
  if (hue < 40) return 'Orange';
  if (hue < 65) return 'Gelb';
  if (hue < 165) return 'Grün';
  if (hue < 195) return 'Türkis';
  if (hue < 255) return 'Blau';
  if (hue < 290) return 'Lila';
  return 'Pink';
}

function toHsl(colorHex: ColorHex): Hsl {
  const red = parseInt(colorHex.slice(1, 3), 16) / 255;
  const green = parseInt(colorHex.slice(3, 5), 16) / 255;
  const blue = parseInt(colorHex.slice(5, 7), 16) / 255;

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { hue: 0, saturation: 0, lightness };

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const hue = toHue(red, green, blue, max, delta);
  return { hue, saturation, lightness };
}

function toHue(red: number, green: number, blue: number, max: number, delta: number): number {
  return (toHueSector(red, green, blue, max, delta) * 60 + 360) % 360;
}

function toHueSector(red: number, green: number, blue: number, max: number, delta: number): number {
  if (max === red) return ((green - blue) / delta) % 6;
  if (max === green) return (blue - red) / delta + 2;
  return (red - green) / delta + 4;
}
