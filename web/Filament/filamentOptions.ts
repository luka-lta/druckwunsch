import type { AmsTrayResponse, FilamentResponse } from '../../shared/api';
import { parseColorHex, toColorName } from '../../shared/ColorHex';

/** Eine auswählbare Farbe im Wunsch-Formular */
export interface FilamentOption {
  readonly key: string;
  readonly name: string;
  readonly colorHex: string;
  /** Material-Beschreibung, z.B. "PLA Matte" */
  readonly material: string;
  /** true, wenn die Spule gerade im Drucker (AMS) steckt */
  readonly isLoaded: boolean;
  /** AMS-Slot, z.B. "A2"; null für Spulen aus der Bibliothek */
  readonly slot: string | null;
  /** Wert, der als Farbe im Wunsch gespeichert wird */
  readonly value: string;
}

/**
 * Kombiniert die Spulen im AMS mit der Bibliothek. Eine Bibliotheks-Spule mit gleicher Farbe und
 * gleichem Material gibt der AMS-Spule ihren Namen (z.B. "Latte Brown" statt "Braun").
 */
export function toFilamentOptions(
amsTrays: readonly AmsTrayResponse[],
filaments: readonly FilamentResponse[],
): FilamentOption[] {
  const usedLibraryIds = new Set<number>();
  const loaded: FilamentOption[] = [];

  for (const tray of amsTrays) {
    const colorHex = parseColorHex(tray.colorHex);
    if (colorHex === null || tray.material === null) continue;

    const libraryMatch = findMatchingFilament(tray, filaments);
    if (libraryMatch !== null) usedLibraryIds.add(libraryMatch.id);

    const name = libraryMatch?.name ?? tray.catalogName ?? toColorName(colorHex);
    const material = tray.subBrand ?? tray.material;
    if (loaded.some((option) => option.name === name && option.material === material)) continue;

    loaded.push({
      key: `ams-${tray.slot}`,
      name,
      colorHex,
      material,
      isLoaded: true,
      slot: tray.slot,
      value: `${name} (${material})`,
    });
  }

  const library = filaments
    .filter((filament) => filament.isAvailable && !usedLibraryIds.has(filament.id))
    .map((filament): FilamentOption => ({
      key: `library-${filament.id}`,
      name: filament.name,
      colorHex: filament.colorHex,
      material: filament.material,
      isLoaded: false,
      slot: null,
      value: `${filament.name} (${filament.material})`,
    }));

  return [...loaded, ...library];
}

/**
 * Sucht die Bibliotheks-Spule zu einer AMS-Spule: gleiche Farbe und gleiches Material.
 * Als Material zählt der Typ ("PLA") oder die Produktlinie ("PLA Matte").
 */
export function findMatchingFilament(
tray: AmsTrayResponse,
filaments: readonly FilamentResponse[],
): FilamentResponse | null {
  const colorHex = parseColorHex(tray.colorHex);
  if (colorHex === null || tray.material === null) return null;

  const trayMaterials = [tray.material, tray.subBrand]
    .filter((material): material is string => material !== null)
    .map(toMaterialKey);
  const match = filaments.find(
    (filament) => filament.colorHex.toUpperCase() === colorHex && trayMaterials.includes(toMaterialKey(filament.material)),
  );
  return match ?? null;
}

function toMaterialKey(material: string): string {
  return material.trim().toLocaleLowerCase('de-DE');
}
