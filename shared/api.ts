// Öffentliche Datenstrukturen der HTTP-API, die Server und Frontend gemeinsam nutzen.
// Interne Server-Strukturen werden nie direkt serialisiert, sondern auf diese Typen abgebildet.

export type Role = 'admin' | 'family';

/** Höchstzahl an Exemplaren pro Druckwunsch */
export const MAX_QUANTITY = 20;

export const PRINT_REQUEST_STATUSES = [
  /** Auf der Merkliste: noch kein Wunsch, nur für die Person selbst sichtbar */
  'saved',
  'new',
  'accepted',
  'printing',
  'done',
  'collected',
  'rejected',
] as const;

export type PrintRequestStatus = (typeof PRINT_REQUEST_STATUSES)[number];

/** Status, die ein Admin in der Warteschlange setzen kann (ohne Merkliste) */
export const QUEUE_STATUSES = PRINT_REQUEST_STATUSES.filter((status) => status !== 'saved');

export interface MeResponse {
  name: string;
  role: Role;
}

export interface LoginRequest {
  name: string;
  code: string;
}

export interface CreatePrintRequestRequest {
  url: string;
  /** Optional; leer lassen, um den Titel von MakerWorld zu übernehmen */
  title?: string;
  /** true: nur auf die Merkliste setzen statt direkt zu wünschen */
  isSaved?: boolean;
  color: string;
  quantity: number;
  note: string;
}

/** Mindestens eines der Felder muss gesetzt sein */
export interface UpdatePrintRequestRequest {
  status?: PrintRequestStatus;
  isUrgent?: boolean;
}

export interface UpdateOrderRequest {
  /** IDs einer Board-Spalte in der gewünschten Reihenfolge */
  ids: number[];
}

export interface PrintRequestResponse {
  id: number;
  requesterName: string;
  isOwn: boolean;
  url: string;
  title: string;
  imageUrl: string | null;
  color: string;
  quantity: number;
  note: string;
  status: PrintRequestStatus;
  createdAt: string;
  updatedAt: string;
  /** Name des Druckauftrags am Drucker, mit dem der Wunsch verknüpft ist */
  printJobName: string | null;
  /** Geschätzter Filamentverbrauch in Gramm, sobald der Druck abgeschlossen ist */
  filamentGrams: number | null;
  isUrgent: boolean;
}

export interface PreviewResponse {
  url: string;
  title: string;
  imageUrl: string | null;
}

export interface ErrorResponse {
  error: string;
}

export type PrinterState = 'offline' | 'idle' | 'preparing' | 'printing' | 'paused' | 'finished' | 'failed';

export interface PrinterStatusResponse {
  /** false, wenn in der Server-Konfiguration kein Drucker hinterlegt ist */
  isEnabled: boolean;
  isConnected: boolean;
  state: PrinterState;
  progressPercent: number | null;
  remainingMinutes: number | null;
  jobName: string | null;
  currentLayer: number | null;
  totalLayers: number | null;
  nozzleTemperature: number | null;
  bedTemperature: number | null;
  updatedAt: string | null;
  amsTrays: AmsTrayResponse[];
}

export interface AmsTrayResponse {
  /** Anzeigename des Slots, z.B. "A1" oder "Extern" */
  slot: string;
  /** null bei leerem Slot */
  colorHex: string | null;
  material: string | null;
  subBrand: string | null;
  /** null, wenn der Drucker die Restmenge nicht kennt (z.B. Spule ohne RFID) */
  remainPercent: number | null;
  /** Geschätzte Restmenge in Gramm aus Prozent und Spulengewicht */
  remainingGrams: number | null;
  /** Offizieller Bambu-Farbname, falls die Spule im Katalog gefunden wurde */
  catalogName: string | null;
  /** Fünfstellige Bambu-Farbnummer, z.B. "10501" */
  catalogCode: string | null;
}

export interface CatalogEntryResponse {
  code: string;
  name: string;
  /** Produktlinie, z.B. "PLA Basic" */
  productLine: string;
  /** Hauptfarbe; bei mehrfarbigen Filamenten die erste */
  colorHex: string;
  colors: string[];
}

export interface FilamentResponse {
  id: number;
  name: string;
  material: string;
  colorHex: string;
  isAvailable: boolean;
}

export interface FilamentRequest {
  name: string;
  material: string;
  colorHex: string;
  isAvailable: boolean;
}

export interface StatisticsResponse {
  totalRequests: number;
  /** Summe der Exemplare aller fertigen und abgeholten Wünsche */
  printedPieces: number;
  /** Geschätzter Filamentverbrauch aller erfassten Drucke in Gramm */
  filamentGrams: number;
  openRequests: number;
  /** Durchschnitt vom Wunsch bis "Fertig" in Stunden; null ohne fertige Wünsche */
  averageWaitHours: number | null;
  requestsPerMonth: MonthCountResponse[];
  topRequesters: RequesterStatisticsResponse[];
  topColors: ColorStatisticsResponse[];
}

export interface MonthCountResponse {
  /** Format "2026-10" */
  month: string;
  count: number;
}

export interface RequesterStatisticsResponse {
  name: string;
  requestCount: number;
  printedPieces: number;
}

export interface ColorStatisticsResponse {
  name: string;
  /** null für "Egal", "Andere" und unbekannte Farbnamen */
  colorHex: string | null;
  count: number;
}
