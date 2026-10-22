import { useState, type ReactNode } from 'react';
import { ArchiveIcon, ChartColumnIcon, CheckIcon, FlameIcon, RefreshCwIcon, LayoutGridIcon, PlusIcon, SpoolIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { PrintRequestResponse, PrintRequestStatus } from '../../shared/api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { deletePrintRequest, updatePrintRequest, updatePrintRequestOrder, updatePrintRequestStatus } from '../apiClient';
import { findLoadedOption } from '../Filament/colorMatch';
import { FilamentPanel } from '../Filament/FilamentPanel';
import { toFilamentOptions, type FilamentOption } from '../Filament/filamentOptions';
import { useFilaments } from '../Filament/useFilaments';
import { toLiveProgress } from '../Printer/liveProgress';
import { PrinterStatusCard } from '../Printer/PrinterStatusCard';
import { usePrinterStatus } from '../Printer/usePrinterStatus';
import { StatisticsPanel } from '../Statistics/StatisticsPanel';
import { AdminActions } from './AdminActions';
import { toBatchGroups, type BatchGroup } from './batchGroups';
import { BatchSuggestion } from './BatchSuggestion';
import { RequestCard, RequestCardSkeleton } from './RequestCard';
import { RequestForm } from './RequestForm';
import { StatusBadge } from './StatusBadge';
import { ARCHIVE_STATUSES, BOARD_COLUMNS, STATUS_LABELS } from './status';
import { usePrintRequests } from './usePrintRequests';

export function AdminBoard() {
  const { requests, error, upsert, remove, reload } = usePrintRequests();
  const printer = usePrinterStatus();
  const { filaments } = useFilaments();
  const filamentOptions = printer?.isEnabled ? toFilamentOptions(printer.amsTrays, filaments ?? []) : null;
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<PrintRequestResponse | null>(null);

  const changeStatus = async (request: PrintRequestResponse, status: PrintRequestStatus) => {
    try {
      upsert(await updatePrintRequestStatus(request.id, status));
      toast.success(`${request.title} → ${STATUS_LABELS[status]}`);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Status ändern fehlgeschlagen');
    }
  };

  const toggleUrgent = async (request: PrintRequestResponse) => {
    try {
      await updatePrintRequest(request.id, { isUrgent: !request.isUrgent });
      await reload();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Ändern fehlgeschlagen');
    }
  };

  const moveWithinColumn = async (column: readonly PrintRequestResponse[], index: number, offset: -1 | 1) => {
    const ids = column.map((request) => request.id);
    const [moved] = ids.splice(index, 1);
    if (moved === undefined) return;
    ids.splice(index + offset, 0, moved);
    try {
      await updatePrintRequestOrder(ids);
      await reload();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Verschieben fehlgeschlagen');
    }
  };

  const printBatch = async (group: BatchGroup) => {
    try {
      for (const request of group.requests) await updatePrintRequestStatus(request.id, 'printing');
      toast.success(`${group.requests.length} Wünsche auf „Druckt“ gesetzt`, {
        description: 'Sie werden mit dem nächsten Druck verknüpft und danach gemeinsam fertig gemeldet.',
      });
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Sammeldruck fehlgeschlagen');
    } finally {
      await reload();
    }
  };

  const removeRequest = async (request: PrintRequestResponse) => {
    try {
      await deletePrintRequest(request.id);
      remove(request.id);
      toast.success('Wunsch gelöscht');
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Löschen fehlgeschlagen');
    }
  };

  const all = requests ?? [];
  const archived = all.filter((request) => ARCHIVE_STATUSES.includes(request.status));
  const openCount = all.filter((request) => BOARD_COLUMNS.includes(request.status)).length;

  // Verschieben nur innerhalb gleicher Dringlichkeit, weil dringende Wünsche immer oben stehen
  const toMoveHandler = (column: readonly PrintRequestResponse[], index: number, offset: -1 | 1) => {
    const request = column[index];
    const neighbor = column[index + offset];
    if (request === undefined || neighbor === undefined || neighbor.isUrgent !== request.isUrgent) return null;
    return () => void moveWithinColumn(column, index, offset);
  };

  const renderCard = (request: PrintRequestResponse, isStacked: boolean, column: readonly PrintRequestResponse[] = []) => {
    const index = column.indexOf(request);
    return (
      <RequestCard
        key={request.id}
        request={request}
        isRequesterVisible
        isStacked={isStacked}
        liveProgress={toLiveProgress(request, printer)}
        badges={toBadges(request, toColorMatch(request, filamentOptions))}
        actions={
          <AdminActions
            request={request}
            onChangeStatus={(status) => changeStatus(request, status)}
            onDelete={() => setDeleteCandidate(request)}
            onToggleUrgent={() => void toggleUrgent(request)}
            onMoveUp={index === -1 ? null : toMoveHandler(column, index, -1)}
            onMoveDown={index === -1 ? null : toMoveHandler(column, index, 1)}
          />
        }
      />
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Warteschlange</h1>
          <p className="text-sm text-muted-foreground">
            {openCount === 1 ? '1 offener Wunsch' : `${openCount} offene Wünsche`}
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <PlusIcon /> Neuer Wunsch
        </Button>
      </div>

      <PrinterStatusCard isDetailed />

      {error !== null && <p className="text-sm text-destructive">{error}</p>}

      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">
            <LayoutGridIcon /> Board
          </TabsTrigger>
          <TabsTrigger value="archive">
            <ArchiveIcon /> Archiv ({archived.length})
          </TabsTrigger>
          <TabsTrigger value="filament">
            <SpoolIcon /> Filament
          </TabsTrigger>
          <TabsTrigger value="statistics">
            <ChartColumnIcon /> Statistik
          </TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {BOARD_COLUMNS.map((status) => {
              const columnRequests = all.filter((request) => request.status === status);
              return (
                <section key={status} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <StatusBadge status={status} />
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">
                      {columnRequests.length}
                    </span>
                  </div>
                  {requests === null && <RequestCardSkeleton />}
                  {requests !== null && columnRequests.length === 0 && (
                    <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                      Nichts hier
                    </div>
                  )}
                  {status === 'accepted' && toBatchGroups(columnRequests).map((group) => (
                    <BatchSuggestion key={group.key} group={group} onPrintAll={printBatch} />
                  ))}
                  {columnRequests.map((request) => renderCard(request, true, columnRequests))}
                </section>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="archive" className="mt-4">
          <div className="grid gap-3 lg:grid-cols-2">
            {archived.length === 0 && <p className="text-sm text-muted-foreground">Das Archiv ist leer.</p>}
            {archived.map((request) => renderCard(request, false))}
          </div>
        </TabsContent>

        <TabsContent value="filament" className="mt-4">
          <FilamentPanel />
        </TabsContent>

        <TabsContent value="statistics" className="mt-4">
          <StatisticsPanel />
        </TabsContent>
      </Tabs>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Neuer Druckwunsch</DialogTitle>
            <DialogDescription>Ein Modell, das du selbst drucken möchtest.</DialogDescription>
          </DialogHeader>
          <RequestForm
            onCreated={(request) => {
              upsert(request);
              setIsFormOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteCandidate !== null} onOpenChange={(isOpen) => !isOpen && setDeleteCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wunsch endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{deleteCandidate?.title}“ von {deleteCandidate?.requesterName} wird gelöscht. Das lässt sich nicht
              rückgängig machen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleteCandidate !== null && removeRequest(deleteCandidate)}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Status, bei denen die Farbe noch eine Rolle spielt */
const COLOR_RELEVANT_STATUSES = new Set(['new', 'accepted', 'printing']);

type ColorMatch = { kind: 'loaded'; slot: string | null } | { kind: 'swap' } | null;

/** Steckt die gewünschte Farbe gerade im AMS? Ohne Drucker oder bei "egal" keine Aussage (null) */
function toColorMatch(request: PrintRequestResponse, options: FilamentOption[] | null): ColorMatch {
  if (options === null || request.color === '' || !COLOR_RELEVANT_STATUSES.has(request.status)) return null;
  const loaded = findLoadedOption(request.color, options);
  return loaded === null ? { kind: 'swap' } : { kind: 'loaded', slot: loaded.slot };
}

function toBadges(request: PrintRequestResponse, colorMatch: ColorMatch): ReactNode {
  if (!request.isUrgent && colorMatch === null) return undefined;
  return (
    <>
      {request.isUrgent && (
        <Badge variant="destructive">
          <FlameIcon data-icon="inline-start" /> Dringend
        </Badge>
      )}
      {colorMatch?.kind === 'loaded' && (
        <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
          <CheckIcon data-icon="inline-start" /> Im AMS{colorMatch.slot !== null && ` · ${colorMatch.slot}`}
        </Badge>
      )}
      {colorMatch?.kind === 'swap' && (
        <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">
          <RefreshCwIcon data-icon="inline-start" /> Spule wechseln
        </Badge>
      )}
    </>
  );
}
