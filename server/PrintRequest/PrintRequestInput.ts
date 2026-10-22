import { MAX_QUANTITY, PRINT_REQUEST_STATUSES, type PrintRequestStatus } from '../../shared/api';
import { parseMakerWorldLink, type MakerWorldLink } from './MakerWorldLink';
import { MAX_TITLE_LENGTH } from './ModelPreview';

/** Maximale Länge der Farbangabe in Zeichen */
export const MAX_COLOR_LENGTH = 40;

/** Maximale Länge der Notiz in Zeichen */
export const MAX_NOTE_LENGTH = 500;

export type ParseResult<T> = { readonly isOk: true; readonly value: T } | { readonly isOk: false; readonly error: string };

/** Geprüfte Eingabe für einen neuen Druckwunsch */
export interface PrintRequestInput {
  readonly link: MakerWorldLink;
  /** Vom Nutzer eingegebener Titel, null wenn keiner angegeben wurde */
  readonly title: string | null;
  readonly color: string;
  readonly quantity: number;
  readonly note: string;
  /** Nur merken statt direkt wünschen */
  readonly isSaved: boolean;
}

export function parsePrintRequestInput(body: unknown): ParseResult<PrintRequestInput> {
  if (typeof body !== 'object' || body === null) return fail('Ungültige Anfrage');
  const fields = body as Record<string, unknown>;

  const link = typeof fields.url === 'string' ? parseMakerWorldLink(fields.url) : null;
  if (link === null) return fail('Bitte einen gültigen MakerWorld-Link zu einem Modell angeben');

  const title = typeof fields.title === 'string' ? fields.title.trim().replace(/\s+/g, ' ') : '';
  if ([...title].length > MAX_TITLE_LENGTH) return fail(`Der Titel darf höchstens ${MAX_TITLE_LENGTH} Zeichen haben`);

  const color = typeof fields.color === 'string' ? fields.color.trim() : '';
  if ([...color].length > MAX_COLOR_LENGTH) return fail(`Die Farbe darf höchstens ${MAX_COLOR_LENGTH} Zeichen haben`);

  const quantity = fields.quantity;
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    return fail(`Die Anzahl muss zwischen 1 und ${MAX_QUANTITY} liegen`);
  }

  const note = typeof fields.note === 'string' ? fields.note.trim() : '';
  if ([...note].length > MAX_NOTE_LENGTH) return fail(`Die Notiz darf höchstens ${MAX_NOTE_LENGTH} Zeichen haben`);

  if (fields.isSaved !== undefined && typeof fields.isSaved !== 'boolean') return fail('Ungültige Angabe zur Merkliste');
  const isSaved = fields.isSaved === true;

  return { isOk: true, value: { link, title: title === '' ? null : title, color, quantity, note, isSaved } };
}

/** Geprüfte Änderung durch einen Admin; null bedeutet "nicht ändern" */
export interface PrintRequestUpdate {
  readonly status: PrintRequestStatus | null;
  readonly isUrgent: boolean | null;
}

export function parsePrintRequestUpdate(body: unknown): ParseResult<PrintRequestUpdate> {
  if (typeof body !== 'object' || body === null) return fail('Ungültige Anfrage');
  const fields = body as Record<string, unknown>;

  // Die Merkliste gehört der Person selbst; ein Admin kann Wünsche nicht dorthin zurücklegen
  const status = fields.status === undefined ? null : parsePrintRequestStatus(fields.status);
  if (fields.status !== undefined && (status === null || status === 'saved')) return fail('Ungültiger Status');

  if (fields.isUrgent !== undefined && typeof fields.isUrgent !== 'boolean') return fail('Ungültige Angabe zu "dringend"');
  const isUrgent = typeof fields.isUrgent === 'boolean' ? fields.isUrgent : null;

  if (status === null && isUrgent === null) return fail('Keine Änderung angegeben');
  return { isOk: true, value: { status, isUrgent } };
}

export function parsePrintRequestStatus(value: unknown): PrintRequestStatus | null {
  const status = PRINT_REQUEST_STATUSES.find((candidate) => candidate === value);
  return status ?? null;
}

function fail(error: string): ParseResult<never> {
  return { isOk: false, error };
}
