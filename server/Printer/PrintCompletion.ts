import type { PrinterState } from '../../shared/api';
import type { PrintRequest, PrintRequestRepository } from '../PrintRequest/Repository/PrintRequestRepository';

const ACTIVE_STATES: readonly PrinterState[] = ['printing', 'paused'];

/**
 * Setzt einen Wunsch automatisch auf "Fertig", wenn der Drucker einen Druck beendet.
 * Das passiert nur, wenn genau ein Wunsch auf "Druckt" steht, sonst wäre die Zuordnung geraten.
 */
export function completePrintOnFinish(
previous: PrinterState,
current: PrinterState,
printRequests: PrintRequestRepository,
now: Date,
): PrintRequest | null {
  if (current !== 'finished') return null;
  if (!ACTIVE_STATES.includes(previous)) return null;

  const printing = printRequests.loadAllPrintRequests().filter((request) => request.status === 'printing');
  if (printing.length !== 1) return null;

  const [request] = printing;
  if (request === undefined) return null;
  printRequests.updateStatus(request.id, 'done', now);
  return request;
}
