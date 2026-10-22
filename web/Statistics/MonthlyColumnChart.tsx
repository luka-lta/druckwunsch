import type { MonthCountResponse } from '../../shared/api';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** Höhe der Zeichenfläche in Pixeln */
const PLOT_HEIGHT_PX = 160;

/** Angestrebte Anzahl Rasterlinien über der Nulllinie */
const TARGET_TICK_COUNT = 4;

const MONTH_SHORT = new Intl.DateTimeFormat('de-DE', { month: 'short', timeZone: 'UTC' });
const MONTH_LONG = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Säulendiagramm: Wünsche pro Monat, eine Serie in der Diagrammfarbe */
export function MonthlyColumnChart({ months }: { months: readonly MonthCountResponse[] }) {
  const maxCount = Math.max(0, ...months.map((month) => month.count));
  const ticks = toTicks(maxCount);
  const yMax = ticks.at(-1) ?? 1;

  return (
    // Oberer Abstand, damit der Wert über der höchsten Säule nicht an den Kartentitel stößt
    <div className="mt-5 flex gap-2">
      <div className="relative w-6 shrink-0 text-right text-xs text-muted-foreground tabular-nums" style={{ height: PLOT_HEIGHT_PX }}>
        {ticks.map((tick) => (
          <span key={tick} className="absolute right-0 translate-y-1/2" style={{ bottom: `${(tick / yMax) * 100}%` }}>
            {tick}
          </span>
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="relative" style={{ height: PLOT_HEIGHT_PX }}>
          {ticks.map((tick) => (
            <div
              key={tick}
              className="absolute inset-x-0 h-px bg-border"
              style={{ bottom: `${(tick / yMax) * 100}%` }}
              aria-hidden="true"
            />
          ))}

          <div className="absolute inset-0 flex items-end">
            {months.map((month) => (
              <Column key={month.month} month={month} yMax={yMax} />
            ))}
          </div>
        </div>

        <div className="flex">
          {months.map((month, index) => (
            <span key={month.month} className="flex-1 text-center text-[11px] text-muted-foreground">
              {toMonthLabel(month.month, index === 0)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Column({ month, yMax }: { month: MonthCountResponse; yMax: number }) {
  const heightPercent = (month.count / yMax) * 100;
  const description = `${MONTH_LONG.format(toDate(month.month))}: ${month.count} ${month.count === 1 ? 'Wunsch' : 'Wünsche'}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Die ganze Spalte ist Hover- und Fokusfläche, nicht nur die gemalte Säule */}
        <div
          tabIndex={0}
          aria-label={description}
          className="group/column flex h-full flex-1 flex-col items-center justify-end rounded-sm outline-none focus-visible:bg-muted/60 hover:bg-muted/40"
        >
          {/* Die Beschriftung sitzt absolut über der Säule, damit sie die Säulenhöhe nicht verfälscht */}
          {month.count > 0 && (
            <div
              className="relative w-[min(24px,60%)] rounded-t-[4px] bg-chart-1 transition-opacity group-hover/column:opacity-80"
              style={{ height: `${heightPercent}%` }}
            >
              <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-xs font-medium text-foreground tabular-nums">
                {month.count}
              </span>
            </div>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>{description}</TooltipContent>
    </Tooltip>
  );
}

/** Ganzzahlige, runde Rasterwerte von 0 bis knapp über dem Maximum */
function toTicks(maxCount: number): number[] {
  if (maxCount <= 0) return [0, 1];
  const roughStep = maxCount / TARGET_TICK_COUNT;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(1, roughStep)));
  const step = Math.max(1, [1, 2, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= roughStep) ?? magnitude);
  const top = Math.ceil(maxCount / step) * step;
  return Array.from({ length: top / step + 1 }, (_, index) => index * step);
}

// Der erste Monat und jeder Januar zeigen das Jahr, damit der Jahreswechsel erkennbar ist
function toMonthLabel(month: string, isFirst: boolean): string {
  const date = toDate(month);
  const label = MONTH_SHORT.format(date).replace('.', '');
  if (!isFirst && date.getUTCMonth() !== 0) return label;
  return `${label} ${String(date.getUTCFullYear()).slice(2)}`;
}

function toDate(month: string): Date {
  const [year = 1970, monthNumber = 1] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1));
}
