import type { DatabaseSync } from 'node:sqlite';

export type PrintJobId = number & { readonly __brand: 'PrintJobId' };

export type PrintJobResult = 'running' | 'finished' | 'failed';

/** Restmenge einer Spule zu Druckbeginn, Grundlage der Verbrauchsberechnung */
export interface SpoolSnapshot {
  readonly slot: string;
  readonly remainPercent: number;
  readonly weightGrams: number;
}

export interface PrintJob {
  readonly id: PrintJobId;
  readonly jobKey: string;
  readonly name: string;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly result: PrintJobResult;
  readonly startSnapshot: readonly SpoolSnapshot[];
  readonly filamentGrams: number | null;
}

const SELECT_FIELDS =
  'SELECT id, job_key, name, started_at, finished_at, result, start_snapshot, filament_grams FROM print_jobs';

export class PrintJobRepository {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  loadRunningJobByKey(jobKey: string): PrintJob | null {
    const row = this.database
      .prepare(`${SELECT_FIELDS} WHERE job_key = ? AND result = 'running' ORDER BY id DESC LIMIT 1`)
      .get(jobKey);
    return row === undefined ? null : toPrintJob(row);
  }

  loadPrintJob(id: PrintJobId): PrintJob | null {
    const row = this.database.prepare(`${SELECT_FIELDS} WHERE id = ?`).get(id);
    return row === undefined ? null : toPrintJob(row);
  }

  /** Summe des Verbrauchs aller abgeschlossenen Drucke in Gramm */
  loadTotalFilamentGrams(): number {
    const row = this.database
      .prepare("SELECT COALESCE(SUM(filament_grams), 0) AS total FROM print_jobs WHERE result <> 'running'")
      .get();
    return Number(row?.total ?? 0);
  }

  createPrintJob(jobKey: string, name: string, startSnapshot: readonly SpoolSnapshot[], now: Date): PrintJobId {
    const result = this.database
      .prepare(
        `INSERT INTO print_jobs (job_key, name, started_at, result, start_snapshot)
        VALUES (?, ?, ?, 'running', ?)`,
      )
      .run(jobKey, name, now.toISOString(), JSON.stringify(startSnapshot));
    return Number(result.lastInsertRowid) as PrintJobId;
  }

  finishPrintJob(id: PrintJobId, result: Exclude<PrintJobResult, 'running'>, filamentGrams: number | null, now: Date): void {
    this.database
      .prepare('UPDATE print_jobs SET result = ?, finished_at = ?, filament_grams = ? WHERE id = ?')
      .run(result, now.toISOString(), filamentGrams, id);
  }
}

function toPrintJob(row: Record<string, unknown>): PrintJob {
  return {
    id: Number(row.id) as PrintJobId,
    jobKey: String(row.job_key),
    name: String(row.name),
    startedAt: String(row.started_at),
    finishedAt: row.finished_at === null ? null : String(row.finished_at),
    result: parseResult(row.result),
    startSnapshot: parseSnapshot(row.start_snapshot),
    filamentGrams: row.filament_grams === null ? null : Number(row.filament_grams),
  };
}

function parseResult(value: unknown): PrintJobResult {
  if (value === 'finished' || value === 'failed') return value;
  return 'running';
}

function parseSnapshot(value: unknown): SpoolSnapshot[] {
  try {
    const parsed: unknown = JSON.parse(String(value));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSpoolSnapshot);
  } catch {
    return [];
  }
}

function isSpoolSnapshot(value: unknown): value is SpoolSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const fields = value as Record<string, unknown>;
  return typeof fields.slot === 'string'
    && typeof fields.remainPercent === 'number'
    && typeof fields.weightGrams === 'number';
}
