import { parseColorHex, toColorName } from '../../shared/ColorHex';
import type { FilamentOption } from './filamentOptions';

/** Farbname ohne Material, kleingeschrieben: "Bambusgrün (PLA Basic)" → "bambusgrün" */
export function toColorKey(color: string): string {
  return color.replace(/\s*\([^)]*\)\s*$/, '').trim().toLocaleLowerCase('de-DE');
}

/**
 * Sucht die geladene AMS-Spule zur Wunschfarbe. Zuerst exakt mit Material, dann über den Namen,
 * zuletzt über den allgemeinen Farbnamen des Farbtons ("grün" passt zu "Bambusgrün").
 */
export function findLoadedOption(requestColor: string, options: readonly FilamentOption[]): FilamentOption | null {
  const loaded = options.filter((option) => option.isLoaded);
  const fullKey = requestColor.trim().toLocaleLowerCase('de-DE');
  const exact = loaded.find((option) => option.value.toLocaleLowerCase('de-DE') === fullKey);
  if (exact !== undefined) return exact;

  const colorKey = toColorKey(requestColor);
  const byName = loaded.find((option) => option.name.toLocaleLowerCase('de-DE') === colorKey);
  if (byName !== undefined) return byName;

  return loaded.find((option) => toGenericColorKey(option.colorHex) === colorKey) ?? null;
}

function toGenericColorKey(colorHex: string): string | null {
  const parsed = parseColorHex(colorHex);
  return parsed === null ? null : toColorName(parsed).toLocaleLowerCase('de-DE');
}
