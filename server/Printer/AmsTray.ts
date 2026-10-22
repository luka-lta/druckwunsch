import { parseColorHex, type ColorHex } from '../../shared/ColorHex';
import type { RawPrintFields } from './PrinterStatus';

/** Ab dieser ID meldet der Drucker AMS HT statt normaler AMS-Einheiten */
const AMS_HT_FIRST_ID = 128;

/** IDs, unter denen der externe Spulenhalter gemeldet wird */
const EXTERNAL_TRAY_IDS = new Set(['254', '255']);

const UNIT_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface AmsTray {
  readonly slot: string;
  readonly colorHex: ColorHex | null;
  readonly material: string | null;
  readonly subBrand: string | null;
  readonly remainPercent: number | null;
  /** Material-ID für den Katalogabgleich, z.B. "GFA00" */
  readonly trayInfoIdx: string | null;
  /** Spulenkennung für den Katalogabgleich, z.B. "A00-G6" */
  readonly trayIdName: string | null;
  /** Gewicht einer vollen Spule in Gramm, für die Verbrauchsberechnung */
  readonly weightGrams: number | null;
}

/**
 * Restmenge in Gramm aus Prozent und Spulengewicht. Der Drucker meldet ganze Prozent,
 * bei 1-kg-Spulen ist das Ergebnis also auf etwa 10 g genau.
 */
export function toRemainingGrams(tray: Pick<AmsTray, 'remainPercent' | 'weightGrams'>): number | null {
  if (tray.remainPercent === null || tray.weightGrams === null) return null;
  return Math.round((tray.remainPercent / 100) * tray.weightGrams);
}

/** Liest die Spulen aus den Feldern "ams" und "vt_tray"/"vir_slot" des Drucker-Reports */
export function parseAmsTrays(raw: RawPrintFields): AmsTray[] {
  const trays = parseAmsUnits(raw.ams);
  const external = parseExternalTray(raw);
  return external === null ? trays : [...trays, external];
}

function parseAmsUnits(ams: unknown): AmsTray[] {
  const units = asRecord(ams)?.ams;
  if (!Array.isArray(units)) return [];

  return units.flatMap((unit) => {
    const unitRecord = asRecord(unit);
    if (unitRecord === null || !Array.isArray(unitRecord.tray)) return [];
    const unitLabel = toUnitLabel(Number(unitRecord.id));

    return unitRecord.tray.flatMap((tray) => {
      const trayRecord = asRecord(tray);
      if (trayRecord === null) return [];
      return [toAmsTray(`${unitLabel}${Number(trayRecord.id) + 1}`, trayRecord)];
    });
  });
}

// Je nach Firmware steht der externe Spulenhalter in "vt_tray" oder in "vir_slot"
function parseExternalTray(raw: RawPrintFields): AmsTray | null {
  const candidates = [raw.vt_tray, ...(Array.isArray(raw.vir_slot) ? raw.vir_slot : [])];
  for (const candidate of candidates) {
    const record = asRecord(candidate);
    if (record === null || !EXTERNAL_TRAY_IDS.has(String(record.id))) continue;
    const tray = toAmsTray('Extern', record);
    if (tray.material !== null) return tray;
  }
  return null;
}

function toAmsTray(slot: string, tray: Record<string, unknown>): AmsTray {
  const material = parseText(tray.tray_type);
  if (material === null) {
    return {
      slot,
      colorHex: null,
      material: null,
      subBrand: null,
      remainPercent: null,
      trayInfoIdx: null,
      trayIdName: null,
      weightGrams: null,
    };
  }

  return {
    slot,
    colorHex: parseTrayColor(tray.tray_color),
    material,
    subBrand: parseText(tray.tray_sub_brands),
    remainPercent: parseRemain(tray.remain),
    trayInfoIdx: parseText(tray.tray_info_idx),
    trayIdName: parseText(tray.tray_id_name),
    weightGrams: parseWeight(tray.tray_weight),
  };
}

function toUnitLabel(unitId: number): string {
  if (!Number.isInteger(unitId) || unitId < 0) return '?';
  if (unitId >= AMS_HT_FIRST_ID) return `HT${unitId - AMS_HT_FIRST_ID + 1}-`;
  return UNIT_LETTERS[unitId] ?? '?';
}

// Der Drucker meldet Farben als "RRGGBBAA"; der Alphakanal ist für die Anzeige egal
function parseTrayColor(value: unknown): ColorHex | null {
  if (typeof value !== 'string' || value.length < 6) return null;
  return parseColorHex(value.slice(0, 6));
}

// -1 bedeutet: Restmenge unbekannt (Spule ohne RFID-Chip)
function parseRemain(value: unknown): number | null {
  const remain = Number(value);
  if (!Number.isFinite(remain) || remain < 0) return null;
  return Math.min(100, Math.round(remain));
}

function parseWeight(value: unknown): number | null {
  const weight = Number(value);
  if (!Number.isFinite(weight) || weight <= 0) return null;
  return weight;
}

function parseText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text === '' ? null : text;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
