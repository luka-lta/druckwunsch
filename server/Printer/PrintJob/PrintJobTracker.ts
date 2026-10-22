import type { PrinterState } from '../../../shared/api';
import type { PrintRequest, PrintRequestRepository } from '../../PrintRequest/Repository/PrintRequestRepository';
import type { AmsTray } from '../AmsTray';
import { completePrintOnFinish } from '../PrintCompletion';
import type { PrinterStatus } from '../PrinterStatus';
import type { PrintJobId, PrintJobRepository, SpoolSnapshot } from './PrintJobRepository';

const ACTIVE_STATES: readonly PrinterState[] = ['preparing', 'printing', 'paused'];

export interface PrintJobEvents {
  onRequestsCompleted?: (requests: readonly PrintRequest[]) => void;
}

/**
 * Verfolgt Druckaufträge anhand der Statuswechsel des Druckers: legt beim Start einen Auftrag an,
 * verknüpft die Wünsche auf "Druckt" und schließt ihn am Ende mit dem Filamentverbrauch ab.
 */
export class PrintJobTracker {
  private readonly jobs: PrintJobRepository;
  private readonly printRequests: PrintRequestRepository;
  private readonly now: () => Date;
  private readonly events: PrintJobEvents;
  private activeJobId: PrintJobId | null = null;

  constructor(jobs: PrintJobRepository, printRequests: PrintRequestRepository, now: () => Date, events: PrintJobEvents = {}) {
    this.jobs = jobs;
    this.printRequests = printRequests;
    this.now = now;
    this.events = events;
  }

  /** Laufender Druckauftrag, mit dem neu gestartete Wünsche verknüpft werden */
  getActiveJobId(): PrintJobId | null {
    return this.activeJobId;
  }

  handleStateChange(previous: PrinterState, current: PrinterState, status: PrinterStatus): void {
    if (ACTIVE_STATES.includes(current)) {
      this.startOrResumeJob(status);
      return;
    }
    if ((current === 'finished' || current === 'failed') && ACTIVE_STATES.includes(previous)) {
      this.finishJob(current, status);
      return;
    }
    if (current === 'idle') this.activeJobId = null;
  }

  private startOrResumeJob(status: PrinterStatus): void {
    if (status.jobKey === null) return;

    const existing = this.jobs.loadRunningJobByKey(status.jobKey);
    const jobId = existing?.id ?? this.jobs.createPrintJob(
      status.jobKey,
      status.jobName ?? 'Unbenannter Druck',
      toSnapshot(status.amsTrays),
      this.now(),
    );
    this.activeJobId = jobId;
    this.printRequests.linkUnassignedPrintingRequests(jobId);
  }

  private finishJob(result: 'finished' | 'failed', status: PrinterStatus): void {
    const job = status.jobKey === null ? null : this.jobs.loadRunningJobByKey(status.jobKey);
    this.activeJobId = null;

    // Ohne erfassten Auftrag (z.B. Server-Neustart mitten im Druck) greift die alte Regel
    if (job === null) {
      if (result !== 'finished') return;
      const completed = completePrintOnFinish('printing', 'finished', this.printRequests, this.now());
      if (completed !== null) this.events.onRequestsCompleted?.([completed]);
      return;
    }

    this.jobs.finishPrintJob(job.id, result, toConsumedGrams(job.startSnapshot, status.amsTrays), this.now());
    if (result === 'failed') {
      this.printRequests.unlinkPrintingRequestsOfJob(job.id);
      return;
    }

    const completed = this.printRequests.completeRequestsOfJob(job.id, this.now());
    if (completed.length > 0) this.events.onRequestsCompleted?.(completed);
  }
}

function toSnapshot(trays: readonly AmsTray[]): SpoolSnapshot[] {
  return trays.flatMap((tray) => {
    if (tray.remainPercent === null || tray.weightGrams === null) return [];
    return [{ slot: tray.slot, remainPercent: tray.remainPercent, weightGrams: tray.weightGrams }];
  });
}

/**
 * Verbrauch aus dem Rückgang der Restmenge je Spule. Der Drucker meldet ganze Prozent, bei 1-kg-Spulen
 * ist das Ergebnis also auf etwa 10 g genau. Ohne vergleichbare Werte gibt es kein Ergebnis (null).
 */
export function toConsumedGrams(startSnapshot: readonly SpoolSnapshot[], endTrays: readonly AmsTray[]): number | null {
  let grams = 0;
  let hasComparableSpool = false;

  for (const start of startSnapshot) {
    const end = endTrays.find((tray) => tray.slot === start.slot);
    if (end?.remainPercent === null || end?.remainPercent === undefined) continue;
    hasComparableSpool = true;
    const usedPercent = start.remainPercent - end.remainPercent;
    if (usedPercent > 0) grams += (usedPercent / 100) * start.weightGrams;
  }

  return hasComparableSpool ? Math.round(grams) : null;
}
