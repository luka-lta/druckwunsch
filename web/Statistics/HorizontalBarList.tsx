export interface BarListItem {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  /** Optionale Zusatzinfo unter dem Namen, z.B. "3 Teile gedruckt" */
  readonly detail?: string;
  /** Optionaler Farbpunkt neben dem Namen (z.B. die echte Filamentfarbe); null zeigt einen neutralen Punkt */
  readonly swatch?: string | null;
}

/** Rangliste als horizontale Balken, eine Serie, Wert direkt an der Balkenspitze */
export function HorizontalBarList({ items, emptyText }: { items: readonly BarListItem[]; emptyText: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;

  const maxValue = Math.max(1, ...items.map((item) => item.value));

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.key} className="grid grid-cols-[minmax(0,8rem)_1fr] items-center gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {item.swatch !== undefined && (
              <span
                className="size-3 shrink-0 rounded-full border border-black/15 dark:border-white/20"
                style={{ background: item.swatch ?? 'var(--muted)' }}
                aria-hidden="true"
              />
            )}
            <div className="min-w-0">
              <div className="truncate text-sm">{item.label}</div>
              {item.detail !== undefined && <div className="truncate text-xs text-muted-foreground">{item.detail}</div>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="h-3 min-w-1 rounded-r-[4px] bg-chart-1"
              style={{ width: `${(item.value / maxValue) * 85}%` }}
              aria-hidden="true"
            />
            <span className="text-sm font-medium tabular-nums">{item.value}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
