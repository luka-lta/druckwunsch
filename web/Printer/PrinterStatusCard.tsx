import {
  CircleAlertIcon,
  CircleCheckIcon,
  CirclePauseIcon,
  CoffeeIcon,
  FlameIcon,
  Loader2Icon,
  PrinterIcon,
  WifiOffIcon,
  type LucideIcon,
} from 'lucide-react';
import type { PrinterState, PrinterStatusResponse } from '../../shared/api';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { usePrinterStatus } from './usePrinterStatus';

/** Minuten pro Stunde, für die Restzeit-Anzeige */
const MINUTES_PER_HOUR = 60;

interface StateAppearance {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly iconClassName: string;
}

const STATE_APPEARANCE: Record<PrinterState, StateAppearance> = {
  offline: { label: 'Drucker nicht erreichbar', icon: WifiOffIcon, iconClassName: 'bg-muted text-muted-foreground' },
  idle: { label: 'Drucker ist frei', icon: CoffeeIcon, iconClassName: 'bg-muted text-muted-foreground' },
  preparing: { label: 'Druck wird vorbereitet', icon: Loader2Icon, iconClassName: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  printing: { label: 'Druckt gerade', icon: PrinterIcon, iconClassName: 'bg-primary/15 text-primary' },
  paused: { label: 'Druck pausiert', icon: CirclePauseIcon, iconClassName: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  finished: { label: 'Druck fertig', icon: CircleCheckIcon, iconClassName: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  failed: { label: 'Druck fehlgeschlagen', icon: CircleAlertIcon, iconClassName: 'bg-destructive/15 text-destructive' },
};

/** Live-Status des 3D-Druckers; bleibt unsichtbar, wenn kein Drucker konfiguriert ist */
export function PrinterStatusCard({ isDetailed }: { isDetailed: boolean }) {
  const status = usePrinterStatus();
  if (status === null || !status.isEnabled) return null;

  const appearance = STATE_APPEARANCE[status.state];
  const Icon = appearance.icon;
  const isActive = status.state === 'printing' || status.state === 'paused' || status.state === 'preparing';

  return (
    <Card size="sm" className="flex-row items-center gap-3 px-3">
      <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', appearance.iconClassName)}>
        <Icon className={cn('size-5', status.state === 'preparing' && 'animate-spin')} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <span className="text-sm font-medium">{appearance.label}</span>
            {status.jobName !== null && status.state !== 'idle' && status.state !== 'offline' && (
              <span className="text-sm text-muted-foreground"> · {status.jobName}</span>
            )}
          </div>
          {isActive && status.progressPercent !== null && (
            <span className="shrink-0 text-sm font-semibold tabular-nums">{status.progressPercent} %</span>
          )}
        </div>

        {isActive && status.progressPercent !== null && <Progress value={status.progressPercent} className="h-1.5" />}

        {(isActive || isDetailed) && <StatusDetails status={status} isActive={isActive} isDetailed={isDetailed} />}
      </div>
    </Card>
  );
}

function StatusDetails({
  status,
  isActive,
  isDetailed,
}: {
  status: PrinterStatusResponse;
  isActive: boolean;
  isDetailed: boolean;
}) {
  const details: string[] = [];
  if (isActive && status.remainingMinutes !== null) details.push(`noch ${formatDuration(status.remainingMinutes)}`);
  if (isActive && status.currentLayer !== null && status.totalLayers !== null && status.totalLayers > 0) {
    details.push(`Schicht ${status.currentLayer}/${status.totalLayers}`);
  }

  const hasTemperatures = isDetailed && status.isConnected && status.nozzleTemperature !== null;
  if (details.length === 0 && !hasTemperatures) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
      {details.map((detail) => (
        <span key={detail}>{detail}</span>
      ))}
      {hasTemperatures && (
        <span className="inline-flex items-center gap-1 tabular-nums">
          <FlameIcon className="size-3" />
          Düse {status.nozzleTemperature} °C
          {status.bedTemperature !== null && ` · Bett ${status.bedTemperature} °C`}
        </span>
      )}
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < MINUTES_PER_HOUR) return `${minutes} min`;
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
