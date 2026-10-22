import type { PrinterStatusResponse, PrintRequestResponse } from '../../shared/api';
import type { LiveProgress } from '../PrintRequest/RequestCard';

/** Fortschritt des Druckers, falls genau dieser Wunsch gerade gedruckt wird */
export function toLiveProgress(request: PrintRequestResponse, printer: PrinterStatusResponse | null): LiveProgress | null {
  if (request.status !== 'printing' || request.printJobName === null || printer === null) return null;
  if (printer.state !== 'printing' && printer.state !== 'paused') return null;
  if (printer.jobName !== request.printJobName || printer.progressPercent === null) return null;
  return { percent: printer.progressPercent, remainingMinutes: printer.remainingMinutes };
}
