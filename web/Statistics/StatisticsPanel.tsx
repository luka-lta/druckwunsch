import { useEffect, useState } from 'react';
import type { StatisticsResponse } from '../../shared/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { loadStatistics } from '../apiClient';
import { HorizontalBarList } from './HorizontalBarList';
import { MonthlyColumnChart } from './MonthlyColumnChart';

/** Bis zu dieser Dauer wird die Wartezeit in Stunden angezeigt, darüber in Tagen */
const MAX_HOURS_DISPLAY = 48;

const HOURS_PER_DAY = 24;

const DECIMAL_FORMAT = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

export function StatisticsPanel() {
  const [statistics, setStatistics] = useState<StatisticsResponse | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    loadStatistics()
      .then(setStatistics)
      .catch(() => setHasError(true));
  }, []);

  if (hasError) return <p className="text-sm text-destructive">Statistik konnte nicht geladen werden.</p>;
  if (statistics === null) return <StatisticsSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Wünsche insgesamt" value={String(statistics.totalRequests)} />
        <StatTile label="Gedruckte Teile" value={String(statistics.printedPieces)} />
        <StatTile label="Gerade offen" value={String(statistics.openRequests)} />
        <StatTile label="Filament verbraucht" value={formatGrams(statistics.filamentGrams)} />
        <StatTile
          label="Ø Wartezeit bis fertig"
          value={statistics.averageWaitHours === null ? '–' : formatWait(statistics.averageWaitHours)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Wünsche pro Monat</CardTitle>
          <CardDescription>Die letzten 12 Monate</CardDescription>
        </CardHeader>
        <CardContent>
          <MonthlyColumnChart months={statistics.requestsPerMonth} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Wer wünscht am meisten</CardTitle>
            <CardDescription>Anzahl Wünsche pro Person</CardDescription>
          </CardHeader>
          <CardContent>
            <HorizontalBarList
              emptyText="Noch keine Wünsche."
              items={statistics.topRequesters.map((requester) => ({
                key: requester.name,
                label: requester.name,
                value: requester.requestCount,
                detail: `${requester.printedPieces} ${requester.printedPieces === 1 ? 'Teil' : 'Teile'} gedruckt`,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Beliebteste Farben</CardTitle>
            <CardDescription>Anzahl Wünsche pro Farbe</CardDescription>
          </CardHeader>
          <CardContent>
            <HorizontalBarList
              emptyText="Noch keine Wünsche."
              items={statistics.topColors.map((color) => ({
                key: color.name,
                label: color.name,
                value: color.count,
                swatch: color.colorHex,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-3xl font-semibold tracking-tight">{value}</span>
      </CardContent>
    </Card>
  );
}

function StatisticsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

/** Gramm pro Kilogramm, ab dieser Menge wird in kg angezeigt */
const GRAMS_PER_KILOGRAM = 1000;

function formatGrams(grams: number): string {
  if (grams < GRAMS_PER_KILOGRAM) return `${grams} g`;
  return `${DECIMAL_FORMAT.format(grams / GRAMS_PER_KILOGRAM)} kg`;
}

function formatWait(hours: number): string {
  if (hours < 1) return '< 1 Std.';
  if (hours <= MAX_HOURS_DISPLAY) return `${DECIMAL_FORMAT.format(hours)} Std.`;
  return `${DECIMAL_FORMAT.format(hours / HOURS_PER_DAY)} Tage`;
}
