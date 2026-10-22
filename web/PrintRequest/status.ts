import type { PrintRequestStatus } from '../../shared/api';

export const STATUS_LABELS: Record<PrintRequestStatus, string> = {
  saved: 'Gemerkt',
  new: 'Neu',
  accepted: 'Angenommen',
  printing: 'Druckt',
  done: 'Fertig',
  collected: 'Abgeholt',
  rejected: 'Abgelehnt',
};

/** Kurze Erklärung für die Familie, was der Status bedeutet */
export const STATUS_DESCRIPTIONS: Record<PrintRequestStatus, string> = {
  saved: 'Auf deiner Merkliste, noch nicht gewünscht',
  new: 'Wartet darauf, angeschaut zu werden',
  accepted: 'Ist eingeplant',
  printing: 'Liegt gerade auf dem Drucker',
  done: 'Fertig und abholbereit',
  collected: 'Abgeholt',
  rejected: 'Wird nicht gedruckt',
};

/** Farben der Status-Badges in hellem und dunklem Modus */
export const STATUS_BADGE_CLASSES: Record<PrintRequestStatus, string> = {
  saved: 'bg-muted text-muted-foreground',
  new: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  accepted: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  printing: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  done: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  collected: 'bg-muted text-muted-foreground',
  rejected: 'bg-destructive/10 text-destructive dark:bg-destructive/20',
};

/** Nächster Schritt im Ablauf und die Beschriftung des passenden Buttons */
export const NEXT_STEP: Partial<Record<PrintRequestStatus, { status: PrintRequestStatus; label: string }>> = {
  new: { status: 'accepted', label: 'Annehmen' },
  accepted: { status: 'printing', label: 'Druck starten' },
  printing: { status: 'done', label: 'Fertig' },
  done: { status: 'collected', label: 'Abgeholt' },
};

/** Status, die auf dem Board als eigene Spalte erscheinen */
export const BOARD_COLUMNS: readonly PrintRequestStatus[] = ['new', 'accepted', 'printing', 'done'];

/** Abgeschlossene Status, die im Archiv landen */
export const ARCHIVE_STATUSES: readonly PrintRequestStatus[] = ['collected', 'rejected'];
