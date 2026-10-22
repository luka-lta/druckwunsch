import type {
  ColorStatisticsResponse,
  MonthCountResponse,
  RequesterStatisticsResponse,
  StatisticsResponse,
} from '../../shared/api';
import type { FilamentCatalog } from '../Filament/Catalog/BambuCatalog';
import type { Filament } from '../Filament/Repository/FilamentRepository';
import { COMPLETED_STATUSES, type PrintRequest } from '../PrintRequest/Repository/PrintRequestRepository';

/** Anzahl der Monate im Verlauf, inklusive des aktuellen */
export const MONTH_COUNT = 12;

/** Anzahl einzeln aufgeführter Farben; der Rest wird zu "Andere" zusammengefasst */
export const TOP_COLOR_COUNT = 7;

/** Monate werden in deutscher Zeit gezählt, damit ein Wunsch um 0:30 Uhr im richtigen Monat landet */
const TIME_ZONE = 'Europe/Berlin';

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

const OPEN_STATUSES = new Set(['new', 'accepted', 'printing']);

const ANY_COLOR_NAME = 'Egal';
const OTHER_COLORS_NAME = 'Andere';

/** Farbcodes für die festen Vorschläge im Formular, falls die Farbe nicht in der Bibliothek steht */
const KNOWN_COLORS: Readonly<Record<string, string>> = {
  schwarz: '#18181B',
  weiß: '#FAFAFA',
  grau: '#9CA3AF',
  dunkelgrau: '#4B5563',
  rot: '#EF4444',
  orange: '#F97316',
  gelb: '#FACC15',
  grün: '#22C55E',
  türkis: '#06B6D4',
  blau: '#3B82F6',
  lila: '#A855F7',
  pink: '#EC4899',
  rosa: '#F9A8D4',
  braun: '#92400E',
  beige: '#E7D7B1',
};

interface MutableRequesterStatistics {
  name: string;
  requestCount: number;
  printedPieces: number;
}

interface MutableColorStatistics {
  name: string;
  colorHex: string | null;
  count: number;
}

export function computeStatistics(
requests: readonly PrintRequest[],
filaments: readonly Filament[],
filamentGrams: number,
now: Date,
catalog: Pick<FilamentCatalog, 'findByName'> | null = null,
): StatisticsResponse {
  // Gemerkte Modelle sind noch keine Wünsche und zählen nicht mit
  const submitted = requests.filter((request) => request.status !== 'saved');
  const findColorHex = (color: string) => resolveColorHex(color, filaments, catalog);
  return computeSubmittedStatistics(submitted, findColorHex, filamentGrams, now);
}

function computeSubmittedStatistics(
requests: readonly PrintRequest[],
findColorHex: (color: string) => string | null,
filamentGrams: number,
now: Date,
): StatisticsResponse {
  const completed = requests.filter((request) => COMPLETED_STATUSES.includes(request.status));

  return {
    totalRequests: requests.length,
    printedPieces: sumQuantity(completed),
    filamentGrams: Math.round(filamentGrams),
    openRequests: requests.filter((request) => OPEN_STATUSES.has(request.status)).length,
    averageWaitHours: toAverageWaitHours(completed),
    requestsPerMonth: countPerMonth(requests, now),
    topRequesters: toRequesterStatistics(requests),
    topColors: toColorStatistics(requests, findColorHex),
  };
}

function sumQuantity(requests: readonly PrintRequest[]): number {
  return requests.reduce((sum, request) => sum + request.quantity, 0);
}

function toAverageWaitHours(completed: readonly PrintRequest[]): number | null {
  const waits = completed
    .map((request) => toWaitMilliseconds(request))
    .filter((wait): wait is number => wait !== null);
  if (waits.length === 0) return null;

  const averageMilliseconds = waits.reduce((sum, wait) => sum + wait, 0) / waits.length;
  return Math.round((averageMilliseconds / MILLISECONDS_PER_HOUR) * 10) / 10;
}

function toWaitMilliseconds(request: PrintRequest): number | null {
  if (request.completedAt === null) return null;
  const wait = Date.parse(request.completedAt) - Date.parse(request.createdAt);
  if (!Number.isFinite(wait) || wait < 0) return null;
  return wait;
}

function countPerMonth(requests: readonly PrintRequest[], now: Date): MonthCountResponse[] {
  const months = toLastMonths(now, MONTH_COUNT);
  const counts = new Map(months.map((month) => [month, 0]));
  for (const request of requests) {
    const month = toMonthKey(new Date(request.createdAt));
    const count = counts.get(month);
    if (count !== undefined) counts.set(month, count + 1);
  }
  return months.map((month) => ({ month, count: counts.get(month) ?? 0 }));
}

function toLastMonths(now: Date, count: number): string[] {
  const [year = 0, month = 1] = toMonthKey(now).split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - (count - 1 - index), 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

function toMonthKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit' })
    .formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  return `${year}-${month}`;
}

function toRequesterStatistics(requests: readonly PrintRequest[]): RequesterStatisticsResponse[] {
  const byName = new Map<string, MutableRequesterStatistics>();
  for (const request of requests) {
    const entry = byName.get(request.requesterName) ?? { name: request.requesterName, requestCount: 0, printedPieces: 0 };
    entry.requestCount++;
    if (COMPLETED_STATUSES.includes(request.status)) entry.printedPieces += request.quantity;
    byName.set(request.requesterName, entry);
  }
  return [...byName.values()].sort(
    (first, second) => second.requestCount - first.requestCount || first.name.localeCompare(second.name, 'de'),
  );
}

function toColorStatistics(
requests: readonly PrintRequest[],
findColorHex: (color: string) => string | null,
): ColorStatisticsResponse[] {
  const byKey = new Map<string, MutableColorStatistics>();
  for (const request of requests) {
    const name = toColorName(request.color);
    const key = name.toLocaleLowerCase('de-DE');
    const entry = byKey.get(key) ?? { name, colorHex: findColorHex(request.color), count: 0 };
    entry.count++;
    byKey.set(key, entry);
  }

  const sorted = [...byKey.values()].sort(
    (first, second) => second.count - first.count || first.name.localeCompare(second.name, 'de'),
  );
  if (sorted.length <= TOP_COLOR_COUNT + 1) return sorted;

  const otherCount = sorted.slice(TOP_COLOR_COUNT).reduce((sum, entry) => sum + entry.count, 0);
  return [...sorted.slice(0, TOP_COLOR_COUNT), { name: OTHER_COLORS_NAME, colorHex: null, count: otherCount }];
}

// Gespeichert wird z.B. "Grün (PLA Basic)"; für die Statistik zählt nur der Farbname
function toColorName(color: string): string {
  const name = color.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return name === '' ? ANY_COLOR_NAME : name;
}

// Reihenfolge: eigene Bibliothek, offizieller Bambu-Katalog, feste Standardfarben
function resolveColorHex(
color: string,
filaments: readonly Filament[],
catalog: Pick<FilamentCatalog, 'findByName'> | null,
): string | null {
  const name = toColorName(color);
  const key = name.toLocaleLowerCase('de-DE');
  const material = /\(([^)]*)\)\s*$/.exec(color)?.[1]?.trim() ?? null;

  const filament = filaments.find((candidate) => candidate.name.toLocaleLowerCase('de-DE') === key);
  if (filament !== undefined) return filament.colorHex;

  const catalogEntry = catalog?.findByName(name, material) ?? catalog?.findByName(name, null) ?? null;
  return catalogEntry?.colors[0] ?? KNOWN_COLORS[key] ?? null;
}
