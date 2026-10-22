import { readFile, writeFile } from 'node:fs/promises';
import { parseColorHex, type ColorHex } from '../../../shared/ColorHex';

// Offizieller Farbkatalog aus Bambu Studio. Er steht unter AGPL und wird deshalb nicht in den Code kopiert,
// sondern zur Laufzeit geladen und lokal zwischengespeichert.
export const CATALOG_URL =
  'https://raw.githubusercontent.com/bambulab/BambuStudio/master/resources/profiles/BBL/filament/filaments_color_codes.json';

/** Wie oft der Katalog neu geladen wird: einmal am Tag */
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Maximale Wartezeit beim Laden des Katalogs: 15 Sekunden */
const FETCH_TIMEOUT_MS = 15_000;

/** Maximale Anzahl an Suchtreffern */
export const MAX_SEARCH_RESULTS = 30;

export interface CatalogEntry {
  /** Fünfstellige Farbnummer, die auch auf der Verpackung steht, z.B. "10501" */
  readonly code: string;
  /** Material-ID, die das AMS als tray_info_idx meldet, z.B. "GFA00" */
  readonly filamentId: string;
  /** Kurzcode der Farbe, Teil von tray_id_name im AMS, z.B. "G6" */
  readonly colorCode: string;
  /** Produktlinie, z.B. "PLA Basic" */
  readonly productLine: string;
  readonly name: string;
  readonly colors: readonly ColorHex[];
}

export interface FilamentCatalog {
  search(query: string): CatalogEntry[];
  findByCode(code: string): CatalogEntry | null;
  /** Ordnet eine AMS-Spule zu: tray_info_idx (z.B. "GFA00") und tray_id_name (z.B. "A00-G6") */
  findByTray(trayInfoIdx: string | null, trayIdName: string | null): CatalogEntry | null;
  /** Sucht per Farbname, optional eingeschränkt auf eine Produktlinie wie "PLA Matte" */
  findByName(name: string, productLine: string | null): CatalogEntry | null;
}

/** Liest die Katalog-JSON; unbrauchbare Einträge werden übersprungen */
export function parseCatalog(json: unknown): CatalogEntry[] {
  const data = asRecord(json)?.data;
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const entry = parseEntry(item);
    return entry === null ? [] : [entry];
  });
}

function parseEntry(item: unknown): CatalogEntry | null {
  const fields = asRecord(item);
  if (fields === null) return null;

  const code = asText(fields.fila_color_code);
  const filamentId = asText(fields.fila_id);
  const productLine = asText(fields.fila_type);
  if (code === null || filamentId === null || productLine === null) return null;

  const colors = (Array.isArray(fields.fila_color) ? fields.fila_color : [])
    .map((color) => (typeof color === 'string' ? parseColorHex(color.slice(0, 7)) : null))
    .filter((color): color is ColorHex => color !== null);
  if (colors.length === 0) return null;

  const names = asRecord(fields.fila_color_name);
  const name = asText(names?.de) ?? asText(names?.en) ?? `Farbe ${code}`;

  return { code, filamentId, colorCode: asText(fields.color_code) ?? '', productLine, name, colors };
}

/** Katalog mit Zwischenspeicher auf der Platte; Fehler beim Laden lassen den letzten Stand bestehen */
export class BambuCatalog implements FilamentCatalog {
  private readonly cachePath: string;
  private readonly fetchFunction: typeof fetch;
  private entries: CatalogEntry[] = [];
  private refreshInterval: NodeJS.Timeout | null = null;

  constructor(cachePath: string, fetchFunction: typeof fetch = fetch) {
    this.cachePath = cachePath;
    this.fetchFunction = fetchFunction;
  }

  async start(): Promise<void> {
    await this.loadFromCache();
    await this.refresh();
    this.refreshInterval = setInterval(() => void this.refresh(), REFRESH_INTERVAL_MS);
  }

  stop(): void {
    if (this.refreshInterval !== null) clearInterval(this.refreshInterval);
  }

  getEntryCount(): number {
    return this.entries.length;
  }

  search(query: string): CatalogEntry[] {
    const tokens = toSearchKey(query).split(' ').filter((token) => token !== '');
    if (tokens.length === 0) return [];

    const exact = this.findByCode(query.trim());
    const matches = this.entries.filter((entry) => {
      const haystack = toSearchKey(`${entry.code} ${entry.productLine} ${entry.name}`);
      return tokens.every((token) => haystack.includes(token));
    });
    const sorted = matches
      .filter((entry) => entry !== exact)
      .sort((first, second) => first.productLine.localeCompare(second.productLine) || first.name.localeCompare(second.name, 'de'));
    return [...(exact === null ? [] : [exact]), ...sorted].slice(0, MAX_SEARCH_RESULTS);
  }

  findByCode(code: string): CatalogEntry | null {
    return this.entries.find((entry) => entry.code === code) ?? null;
  }

  findByTray(trayInfoIdx: string | null, trayIdName: string | null): CatalogEntry | null {
    const colorCode = trayIdName?.split('-')[1];
    if (trayInfoIdx === null || colorCode === undefined || colorCode === '') return null;
    return this.entries.find((entry) => entry.filamentId === trayInfoIdx && entry.colorCode === colorCode) ?? null;
  }

  findByName(name: string, productLine: string | null): CatalogEntry | null {
    const nameKey = toSearchKey(name);
    const productLineKey = productLine === null ? null : toSearchKey(productLine);
    const match = this.entries.find((entry) => toSearchKey(entry.name) === nameKey
      && (productLineKey === null || toSearchKey(entry.productLine) === productLineKey));
    return match ?? null;
  }

  /** Setzt die Einträge direkt, z.B. für Tests */
  replaceEntries(entries: CatalogEntry[]): void {
    this.entries = entries;
  }

  private async loadFromCache(): Promise<void> {
    try {
      this.entries = parseCatalog(JSON.parse(await readFile(this.cachePath, 'utf8')));
    } catch {
      // Noch kein Zwischenspeicher vorhanden, das ist beim ersten Start normal
    }
  }

  private async refresh(): Promise<void> {
    try {
      const response = await this.fetchFunction(CATALOG_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!response.ok) {
        console.warn('Failed to load filament catalog', { status: response.status });
        return;
      }
      const text = await response.text();
      const entries = parseCatalog(JSON.parse(text));
      if (entries.length === 0) return;

      this.entries = entries;
      await writeFile(this.cachePath, text, 'utf8');
    } catch (error) {
      console.warn('Failed to load filament catalog', { reason: String(error) });
    }
  }
}

function toSearchKey(value: string): string {
  return value.toLocaleLowerCase('de-DE').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function asText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text === '' ? null : text;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
