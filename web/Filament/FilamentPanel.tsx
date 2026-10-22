import { useState } from 'react';
import { BookmarkPlusIcon, PencilIcon, PlusIcon, SpoolIcon, Trash2Icon, TriangleAlertIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { AmsTrayResponse, FilamentRequest, FilamentResponse } from '../../shared/api';
import { parseColorHex, toColorName } from '../../shared/ColorHex';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { createFilament, deleteFilament, updateFilament } from '../apiClient';
import { usePrinterStatus } from '../Printer/usePrinterStatus';
import { FilamentDialog } from './FilamentDialog';
import { formatRemaining } from './formatRemaining';
import { findMatchingFilament } from './filamentOptions';
import { useFilaments } from './useFilaments';

/** Ab diesem Restbestand in Prozent wird eine Spule als fast leer markiert */
const LOW_REMAIN_PERCENT = 20;

const EMPTY_FILAMENT: FilamentRequest = { name: '', material: 'PLA', colorHex: '#000000', isAvailable: true };

type DialogState = { kind: 'closed' } | { kind: 'create'; initial: FilamentRequest } | { kind: 'edit'; filament: FilamentResponse };

export function FilamentPanel() {
  const printer = usePrinterStatus();
  const { filaments, reload } = useFilaments();
  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' });
  const [deleteCandidate, setDeleteCandidate] = useState<FilamentResponse | null>(null);

  const saveFilament = async (input: FilamentRequest) => {
    try {
      if (dialog.kind === 'edit') await updateFilament(dialog.filament.id, input);
      if (dialog.kind !== 'edit') await createFilament(input);
      toast.success(`${input.name} gespeichert`);
      await reload();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Speichern fehlgeschlagen');
      throw caught;
    }
  };

  const toggleAvailability = async (filament: FilamentResponse, isAvailable: boolean) => {
    try {
      await updateFilament(filament.id, { ...filament, isAvailable });
      await reload();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Ändern fehlgeschlagen');
    }
  };

  const removeFilament = async (filament: FilamentResponse) => {
    try {
      await deleteFilament(filament.id);
      toast.success(`${filament.name} gelöscht`);
      await reload();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Löschen fehlgeschlagen');
    }
  };

  const adoptTray = (tray: AmsTrayResponse) => {
    const colorHex = parseColorHex(tray.colorHex);
    if (colorHex === null) return;
    const material = tray.subBrand ?? tray.material ?? 'PLA';
    const name = tray.catalogName ?? toColorName(colorHex);
    setDialog({ kind: 'create', initial: { name, material, colorHex, isAvailable: true } });
  };

  return (
    <div className="flex flex-col gap-6">
      {printer?.isEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>Im Drucker (AMS)</CardTitle>
            <CardDescription>
              {printer.isConnected ? 'Live vom Drucker gelesen.' : 'Drucker nicht erreichbar, letzter bekannter Stand.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {printer.amsTrays.length === 0 && <p className="text-sm text-muted-foreground">Keine Spulen gemeldet.</p>}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {printer.amsTrays.map((tray) => (
                <AmsTrayCard
                  key={tray.slot}
                  tray={tray}
                  libraryName={findMatchingFilament(tray, filaments ?? [])?.name ?? null}
                  onAdopt={() => adoptTray(tray)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Bibliothek</CardTitle>
          <CardDescription>
            Spulen, die nicht im AMS stecken. Hier vergebene Namen erscheinen auch für passende AMS-Spulen.
          </CardDescription>
          <CardAction>
            <Button size="sm" onClick={() => setDialog({ kind: 'create', initial: EMPTY_FILAMENT })}>
              <PlusIcon /> Spule
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col">
          {filaments === null && <Skeleton className="h-12 w-full" />}
          {filaments?.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center">
              <SpoolIcon className="size-7 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Noch keine Spulen eingetragen.</p>
            </div>
          )}
          {filaments?.map((filament) => (
            <div key={filament.id} className="flex items-center gap-3 border-b py-2.5 last:border-b-0">
              <span
                className="size-6 shrink-0 rounded-full border border-black/15 dark:border-white/20"
                style={{ background: filament.colorHex }}
              />
              <div className={cn('min-w-0 flex-1', !filament.isAvailable && 'opacity-50')}>
                <div className="truncate text-sm font-medium">{filament.name}</div>
                <div className="text-xs text-muted-foreground">
                  {filament.material} · <span className="font-mono">{filament.colorHex}</span>
                </div>
              </div>
              <Switch
                checked={filament.isAvailable}
                onCheckedChange={(isAvailable) => toggleAvailability(filament, isAvailable)}
                aria-label="Verfügbar"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Bearbeiten"
                onClick={() => setDialog({ kind: 'edit', filament })}
              >
                <PencilIcon />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Löschen" onClick={() => setDeleteCandidate(filament)}>
                <Trash2Icon />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <FilamentDialog
        isOpen={dialog.kind !== 'closed'}
        title={dialog.kind === 'edit' ? 'Spule bearbeiten' : 'Neue Spule'}
        initial={toDialogInitial(dialog)}
        onOpenChange={(isOpen) => !isOpen && setDialog({ kind: 'closed' })}
        onSubmit={saveFilament}
      />

      <AlertDialog open={deleteCandidate !== null} onOpenChange={(isOpen) => !isOpen && setDeleteCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Spule löschen?</AlertDialogTitle>
            <AlertDialogDescription>„{deleteCandidate?.name}“ wird aus der Bibliothek entfernt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleteCandidate !== null && removeFilament(deleteCandidate)}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface AmsTrayCardProps {
  tray: AmsTrayResponse;
  libraryName: string | null;
  onAdopt: () => void;
}

function AmsTrayCard({ tray, libraryName, onAdopt }: AmsTrayCardProps) {
  const colorHex = parseColorHex(tray.colorHex);
  if (colorHex === null || tray.material === null) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed p-3 text-muted-foreground">
        <Badge variant="outline">{tray.slot}</Badge>
        <span className="text-sm">leer</span>
      </div>
    );
  }

  const isLow = tray.remainPercent !== null && tray.remainPercent < LOW_REMAIN_PERCENT;

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <span
          className="size-9 shrink-0 rounded-full border border-black/15 shadow-inner dark:border-white/20"
          style={{ background: colorHex }}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{libraryName ?? tray.catalogName ?? toColorName(colorHex)}</div>
          <div className="truncate text-xs text-muted-foreground">
            {tray.subBrand ?? tray.material}
            {tray.catalogCode !== null && <span className="font-mono"> · {tray.catalogCode}</span>}
          </div>
        </div>
        <Badge variant="outline">{tray.slot}</Badge>
      </div>

      <div className="flex items-center gap-2">
        <Progress value={tray.remainPercent ?? 0} className={cn('h-1.5', isLow && '[&>*]:bg-destructive')} />
        <span className={cn('shrink-0 text-right text-xs tabular-nums', isLow ? 'text-destructive' : 'text-muted-foreground')}>
          {formatRemaining(tray)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        {isLow && (
          <span className="inline-flex items-center gap-1 text-xs text-destructive">
            <TriangleAlertIcon className="size-3" /> Fast leer
          </span>
        )}
        {libraryName === null && (
          <Button variant="ghost" size="xs" className="ml-auto" onClick={onAdopt}>
            <BookmarkPlusIcon /> In Bibliothek
          </Button>
        )}
      </div>
    </div>
  );
}

function toDialogInitial(dialog: DialogState): FilamentRequest {
  if (dialog.kind === 'edit') return dialog.filament;
  if (dialog.kind === 'create') return dialog.initial;
  return EMPTY_FILAMENT;
}
