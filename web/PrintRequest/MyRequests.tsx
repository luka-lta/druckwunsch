import { useState } from 'react';
import { BookmarkIcon, InboxIcon, SendIcon, Trash2Icon, Undo2Icon } from 'lucide-react';
import { toast } from 'sonner';
import type { PrintRequestResponse } from '../../shared/api';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { deletePrintRequest, submitSavedPrintRequest } from '../apiClient';
import { toLiveProgress } from '../Printer/liveProgress';
import { PrinterStatusCard } from '../Printer/PrinterStatusCard';
import { usePrinterStatus } from '../Printer/usePrinterStatus';
import { RequestCard, RequestCardSkeleton } from './RequestCard';
import { RequestForm } from './RequestForm';
import { usePrintRequests } from './usePrintRequests';

export function MyRequests() {
  const { requests, error, upsert, remove } = usePrintRequests();
  const printer = usePrinterStatus();
  const [withdrawCandidate, setWithdrawCandidate] = useState<PrintRequestResponse | null>(null);

  const savedRequests = requests?.filter((request) => request.status === 'saved') ?? [];
  const submittedRequests = requests?.filter((request) => request.status !== 'saved') ?? null;

  const handleSubmitSaved = async (request: PrintRequestResponse) => {
    try {
      upsert(await submitSavedPrintRequest(request.id));
      toast.success('Wunsch abgeschickt', { description: request.title });
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Abschicken fehlgeschlagen');
    }
  };

  const handleWithdraw = async (request: PrintRequestResponse) => {
    try {
      await deletePrintRequest(request.id);
      remove(request.id);
      toast.success(request.status === 'saved' ? 'Von der Merkliste entfernt' : 'Wunsch zurückgezogen');
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Zurückziehen fehlgeschlagen');
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <PrinterStatusCard isDetailed={false} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Neuer Druckwunsch</CardTitle>
          <CardDescription>Link von MakerWorld einfügen, Farbe wählen, fertig.</CardDescription>
        </CardHeader>
        <CardContent>
          <RequestForm onCreated={upsert} isSaveAllowed />
        </CardContent>
      </Card>

      {savedRequests.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
              <BookmarkIcon className="size-4.5" /> Merkliste
            </h2>
            <span className="text-sm text-muted-foreground">{savedRequests.length}</span>
          </div>
          {savedRequests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              isRequesterVisible={false}
              actions={
                <>
                  <Button size="sm" onClick={() => void handleSubmitSaved(request)}>
                    <SendIcon /> Jetzt wünschen
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setWithdrawCandidate(request)}>
                    <Trash2Icon /> Entfernen
                  </Button>
                </>
              }
            />
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Meine Wünsche</h2>
          {submittedRequests !== null && submittedRequests.length > 0 && (
            <span className="text-sm text-muted-foreground">{submittedRequests.length}</span>
          )}
        </div>

        {error !== null && <p className="text-sm text-destructive">{error}</p>}
        {requests === null && (
          <>
            <RequestCardSkeleton />
            <RequestCardSkeleton />
          </>
        )}
        {submittedRequests?.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <InboxIcon className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Noch keine Wünsche. Leg oben los!</p>
          </div>
        )}
        {submittedRequests?.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            isRequesterVisible={false}
            liveProgress={toLiveProgress(request, printer)}
            actions={
              request.status === 'new' ? (
                <Button variant="ghost" size="sm" onClick={() => setWithdrawCandidate(request)}>
                  <Undo2Icon /> Zurückziehen
                </Button>
              ) : undefined
            }
          />
        ))}
      </section>

      <AlertDialog open={withdrawCandidate !== null} onOpenChange={(isOpen) => !isOpen && setWithdrawCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {withdrawCandidate?.status === 'saved' ? 'Von der Merkliste entfernen?' : 'Wunsch zurückziehen?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              „{withdrawCandidate?.title}“ wird
              {withdrawCandidate?.status === 'saved' ? ' von deiner Merkliste' : ' aus der Warteschlange'} entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => withdrawCandidate !== null && handleWithdraw(withdrawCandidate)}
            >
              {withdrawCandidate?.status === 'saved' ? 'Entfernen' : 'Zurückziehen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
