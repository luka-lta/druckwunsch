import type { DatabaseSync } from 'node:sqlite';
import type { PrintRequestStatus } from '../../../shared/api';
import type { UserId } from '../../Auth/Session';
import type { PrintJobId } from '../../Printer/PrintJob/PrintJobRepository';
import type { ModelPreview } from '../ModelPreview';
import { parsePrintRequestStatus, type PrintRequestInput } from '../PrintRequestInput';

export type PrintRequestId = number & { readonly __brand: 'PrintRequestId' };

export interface PrintRequest {
  readonly id: PrintRequestId;
  readonly userId: UserId;
  readonly requesterName: string;
  readonly modelId: string;
  readonly url: string;
  readonly title: string;
  readonly imageUrl: string | null;
  readonly color: string;
  readonly quantity: number;
  readonly note: string;
  readonly status: PrintRequestStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Zeitpunkt, an dem der Wunsch zum ersten Mal auf "Fertig" gesetzt wurde */
  readonly completedAt: string | null;
  /** Druckauftrag, mit dem der Wunsch gedruckt wird bzw. wurde */
  readonly printJobId: PrintJobId | null;
  readonly printJobName: string | null;
  /** Anteil am Filamentverbrauch des Druckauftrags, aufgeteilt nach Stückzahl */
  readonly filamentGrams: number | null;
  readonly isUrgent: boolean;
  /** Manuelle Reihenfolge innerhalb einer Board-Spalte; null = nach Eingang */
  readonly position: number | null;
}

/** Status, ab denen ein Wunsch als gedruckt gilt */
export const COMPLETED_STATUSES: readonly PrintRequestStatus[] = ['done', 'collected'];

const SELECT_FIELDS = `
    SELECT p.id, p.user_id, u.name AS requester_name, p.model_id, p.url, p.title, p.image_url,
        p.color, p.quantity, p.note, p.status, p.created_at, p.updated_at, p.completed_at,
        p.print_job_id, j.name AS print_job_name, p.is_urgent, p.position,
        j.filament_grams * p.quantity / NULLIF(
            (SELECT SUM(p2.quantity) FROM print_requests p2 WHERE p2.print_job_id = p.print_job_id), 0
        ) AS filament_grams
    FROM print_requests p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN print_jobs j ON j.id = p.print_job_id`;

export class PrintRequestRepository {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  loadAllPrintRequests(): PrintRequest[] {
    // Dringende zuerst, dann manuell sortierte, dann nach Eingang
    const rows = this.database
      .prepare(`${SELECT_FIELDS} ORDER BY p.is_urgent DESC, p.position IS NULL, p.position, p.created_at, p.id`)
      .all();
    return rows.map(toPrintRequest);
  }

  loadPrintRequestsByUser(userId: UserId): PrintRequest[] {
    const rows = this.database
      .prepare(`${SELECT_FIELDS} WHERE p.user_id = ? ORDER BY p.created_at DESC, p.id DESC`)
      .all(userId);
    return rows.map(toPrintRequest);
  }

  loadPrintRequest(id: PrintRequestId): PrintRequest | null {
    const row = this.database.prepare(`${SELECT_FIELDS} WHERE p.id = ?`).get(id);
    return row === undefined ? null : toPrintRequest(row);
  }

  createPrintRequest(userId: UserId, input: PrintRequestInput, preview: ModelPreview, now: Date): PrintRequestId {
    const timestamp = now.toISOString();
    const result = this.database
      .prepare(
        `INSERT INTO print_requests
            (user_id, model_id, url, title, image_url, color, quantity, note, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        userId,
        input.link.modelId,
        input.link.url,
        preview.title,
        preview.imageUrl,
        input.color,
        input.quantity,
        input.note,
        input.isSaved ? 'saved' : 'new',
        timestamp,
        timestamp,
      );
    return Number(result.lastInsertRowid) as PrintRequestId;
  }

  /** Wünsche, bei denen beim Anlegen kein Vorschaubild geladen werden konnte */
  loadPrintRequestsWithoutImage(): PrintRequest[] {
    const rows = this.database.prepare(`${SELECT_FIELDS} WHERE p.image_url IS NULL ORDER BY p.id ASC`).all();
    return rows.map(toPrintRequest);
  }

  updatePreview(id: PrintRequestId, preview: ModelPreview): void {
    this.database
      .prepare('UPDATE print_requests SET title = ?, image_url = ? WHERE id = ?')
      .run(preview.title, preview.imageUrl, id);
  }

  updateStatus(id: PrintRequestId, status: PrintRequestStatus, now: Date): void {
    this.database
      .prepare(
        `UPDATE print_requests
        SET status = ?, updated_at = ?,
            completed_at = CASE WHEN ? = 1 THEN COALESCE(completed_at, ?) ELSE completed_at END
        WHERE id = ?`,
      )
      .run(status, now.toISOString(), COMPLETED_STATUSES.includes(status) ? 1 : 0, now.toISOString(), id);
  }

  /**
   * Macht aus einem gemerkten Modell einen Wunsch. Das Eingangsdatum wird neu gesetzt,
   * damit der Wunsch hinten in der Warteschlange landet und nicht nach Merk-Datum.
   */
  submitSavedRequest(id: PrintRequestId, now: Date): boolean {
    const result = this.database
      .prepare("UPDATE print_requests SET status = 'new', created_at = ?, updated_at = ? WHERE id = ? AND status = 'saved'")
      .run(now.toISOString(), now.toISOString(), id);
    return Number(result.changes) === 1;
  }

  setUrgent(id: PrintRequestId, isUrgent: boolean, now: Date): void {
    this.database
      .prepare('UPDATE print_requests SET is_urgent = ?, updated_at = ? WHERE id = ?')
      .run(isUrgent ? 1 : 0, now.toISOString(), id);
  }

  /** Speichert die Reihenfolge einer Board-Spalte: Position = Index in der Liste */
  updateOrder(ids: readonly PrintRequestId[]): void {
    const statement = this.database.prepare('UPDATE print_requests SET position = ? WHERE id = ?');
    ids.forEach((id, index) => statement.run(index, id));
  }

  setPrintJob(id: PrintRequestId, printJobId: PrintJobId | null): void {
    this.database.prepare('UPDATE print_requests SET print_job_id = ? WHERE id = ?').run(printJobId, id);
  }

  /** Verknüpft alle Wünsche auf "Druckt" ohne Auftrag mit dem gerade gestarteten Druck */
  linkUnassignedPrintingRequests(printJobId: PrintJobId): number {
    const result = this.database
      .prepare("UPDATE print_requests SET print_job_id = ? WHERE status = 'printing' AND print_job_id IS NULL")
      .run(printJobId);
    return Number(result.changes);
  }

  /** Setzt alle mit dem Druckauftrag verknüpften Wünsche auf "Fertig" und gibt sie zurück */
  completeRequestsOfJob(printJobId: PrintJobId, now: Date): PrintRequest[] {
    const requests = this.loadRequestsOfJob(printJobId).filter((request) => request.status === 'printing');
    for (const request of requests) this.updateStatus(request.id, 'done', now);
    return requests;
  }

  /** Löst die Verknüpfung nach einem Fehldruck, damit der nächste Druck die Wünsche übernimmt */
  unlinkPrintingRequestsOfJob(printJobId: PrintJobId): void {
    this.database
      .prepare("UPDATE print_requests SET print_job_id = NULL WHERE print_job_id = ? AND status = 'printing'")
      .run(printJobId);
  }

  loadRequestsOfJob(printJobId: PrintJobId): PrintRequest[] {
    return this.database.prepare(`${SELECT_FIELDS} WHERE p.print_job_id = ? ORDER BY p.id`).all(printJobId).map(toPrintRequest);
  }

  deletePrintRequest(id: PrintRequestId): void {
    this.database.prepare('DELETE FROM print_requests WHERE id = ?').run(id);
  }
}

function toPrintRequest(row: Record<string, unknown>): PrintRequest {
  const status = parsePrintRequestStatus(row.status);
  if (status === null) throw new Error(`Invalid status in database: ${String(row.status)}`);

  return {
    id: Number(row.id) as PrintRequestId,
    userId: Number(row.user_id) as UserId,
    requesterName: String(row.requester_name),
    modelId: String(row.model_id),
    url: String(row.url),
    title: String(row.title),
    imageUrl: row.image_url === null ? null : String(row.image_url),
    color: String(row.color),
    quantity: Number(row.quantity),
    note: String(row.note),
    status,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    completedAt: row.completed_at === null ? null : String(row.completed_at),
    printJobId: row.print_job_id === null ? null : (Number(row.print_job_id) as PrintJobId),
    printJobName: row.print_job_name === null ? null : String(row.print_job_name),
    filamentGrams: row.filament_grams === null ? null : Math.round(Number(row.filament_grams)),
    isUrgent: Number(row.is_urgent) === 1,
    position: row.position === null ? null : Number(row.position),
  };
}
