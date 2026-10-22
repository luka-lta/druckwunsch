import type { ReactNode } from 'react';
import { CalendarIcon, ExternalLinkIcon, HashIcon, Link2Icon, PaletteIcon, UserIcon, WeightIcon } from 'lucide-react';
import type { PrintRequestResponse } from '../../shared/api';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ModelThumbnail } from './ModelThumbnail';
import { StatusBadge } from './StatusBadge';

const DATE_FORMAT = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

interface Props {
  request: PrintRequestResponse;
  isRequesterVisible: boolean;
  /** Kompakte Darstellung mit Bild oben, für schmale Board-Spalten */
  isStacked?: boolean;
  actions?: ReactNode;
  /** Zusätzliche Hinweise unter den Metadaten, z.B. ob die Farbe im AMS steckt */
  badges?: ReactNode;
  /** Live-Fortschritt, wenn der Wunsch gerade auf dem Drucker liegt */
  liveProgress?: LiveProgress | null;
}

export interface LiveProgress {
  readonly percent: number;
  readonly remainingMinutes: number | null;
}

export function RequestCard({ request, isRequesterVisible, isStacked = false, actions, badges, liveProgress }: Props) {
  return (
    <Card size="sm" className={cn('gap-0 p-0', isStacked ? 'flex-col' : 'flex-row')}>
      <a
        href={request.url}
        target="_blank"
        rel="noreferrer noopener"
        className={cn('shrink-0', isStacked ? 'aspect-[4/3] w-full' : 'size-24 sm:size-28')}
      >
        <ModelThumbnail imageUrl={request.imageUrl} className="size-full rounded-none" />
      </a>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <a
            href={request.url}
            target="_blank"
            rel="noreferrer noopener"
            className="group/title inline-flex min-w-0 items-start gap-1 font-medium leading-snug hover:underline"
          >
            <span className="line-clamp-2 break-words">{request.title}</span>
            <ExternalLinkIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/title:opacity-100" />
          </a>
          <StatusBadge status={request.status} />
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {isRequesterVisible && (
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <UserIcon className="size-3.5" /> {request.requesterName}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <HashIcon className="size-3.5" /> {request.quantity}×
          </span>
          <span className="inline-flex items-center gap-1">
            <PaletteIcon className="size-3.5" /> {request.color === '' ? 'Farbe egal' : request.color}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarIcon className="size-3.5" /> {DATE_FORMAT.format(new Date(request.createdAt))}
          </span>
        </div>

        {(request.filamentGrams !== null || (request.printJobName !== null && request.status === 'printing')) && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {request.printJobName !== null && request.status === 'printing' && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <Link2Icon className="size-3.5 shrink-0" />
                <span className="truncate">{request.printJobName}</span>
              </span>
            )}
            {request.filamentGrams !== null && (
              <span className="inline-flex items-center gap-1">
                <WeightIcon className="size-3.5" /> ≈ {request.filamentGrams} g Filament
              </span>
            )}
          </div>
        )}

        {liveProgress !== undefined && liveProgress !== null && (
          <div className="flex flex-col gap-1">
            <Progress value={liveProgress.percent} className="h-1.5" />
            <span className="text-xs text-muted-foreground tabular-nums">
              {liveProgress.percent} %
              {liveProgress.remainingMinutes !== null && ` · noch ${formatMinutes(liveProgress.remainingMinutes)}`}
            </span>
          </div>
        )}

        {badges !== undefined && <div className="flex flex-wrap gap-1.5">{badges}</div>}

        {request.note !== '' && (
          <p className="rounded-md bg-muted/60 px-2 py-1.5 text-xs break-words text-muted-foreground">
            {request.note}
          </p>
        )}

        {actions !== undefined && <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">{actions}</div>}
      </div>
    </Card>
  );
}

/** Minuten pro Stunde, für die Restzeit-Anzeige */
const MINUTES_PER_HOUR = 60;

function formatMinutes(minutes: number): string {
  if (minutes < MINUTES_PER_HOUR) return `${minutes} min`;
  const rest = minutes % MINUTES_PER_HOUR;
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function RequestCardSkeleton() {
  return (
    <Card size="sm" className="flex-row gap-0 p-0">
      <Skeleton className="size-24 shrink-0 rounded-none sm:size-28" />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </Card>
  );
}
