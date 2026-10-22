import { useCallback, useEffect, useState } from 'react';
import { ScanBarcodeIcon, SearchIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { CatalogEntryResponse } from '../../shared/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loadCatalogEntry, searchFilamentCatalog } from '../apiClient';
import { BarcodeScanner, isBarcodeScanSupported } from './BarcodeScanner';

/** Wartezeit nach der letzten Eingabe, bevor gesucht wird */
const SEARCH_DEBOUNCE_MS = 250;

/** Höchstzahl angezeigter Treffer, damit die Liste in den Dialog passt */
const MAX_VISIBLE_RESULTS = 8;

// Bambu-Farbnummern sind fünfstellig, z.B. 10501 für Bambusgrün (PLA Basic)
const COLOR_CODE_PATTERN = /\b(\d{5})\b/g;

interface Props {
  onSelect: (entry: CatalogEntryResponse) => void;
}

/** Bambu-Spule aus dem offiziellen Katalog wählen: per Suche, Farbnummer oder Etikett-Scan */
export function CatalogPicker({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogEntryResponse[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const isScanSupported = isBarcodeScanSupported();

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery === '') {
      setResults([]);
      return;
    }

    let isCurrent = true;
    const timeout = window.setTimeout(() => {
      searchFilamentCatalog(trimmedQuery)
        .then((entries) => isCurrent && setResults(entries))
        .catch(() => isCurrent && setResults([]));
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      isCurrent = false;
      window.clearTimeout(timeout);
    };
  }, [query]);

  const handleScan = useCallback(
    async (value: string) => {
      // Im Barcode kann mehr stehen als die Farbnummer, deshalb alle fünfstelligen Zahlen probieren
      for (const match of value.matchAll(COLOR_CODE_PATTERN)) {
        const entry = await loadCatalogEntry(match[1] ?? '').catch(() => null);
        if (entry === null) continue;
        onSelect(entry);
        toast.success(`${entry.name} (${entry.productLine}) erkannt`);
        return;
      }
      setQuery(value);
      toast.info('Keine Bambu-Farbnummer im Code gefunden', { description: value });
    },
    [onSelect],
  );

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Bambu-Katalog: Name, Material oder Nummer"
            className="bg-background pl-8"
            aria-label="Bambu-Katalog durchsuchen"
          />
        </div>
        {isScanSupported && (
          <Button type="button" variant="outline" size="icon" onClick={() => setIsScannerOpen(true)} aria-label="Etikett scannen">
            <ScanBarcodeIcon />
          </Button>
        )}
      </div>

      {query.trim() === '' && (
        <p className="text-xs text-muted-foreground">
          z.B. „pla matte schwarz“ oder die Farbnummer vom Etikett, etwa „10501“.
        </p>
      )}
      {query.trim() !== '' && results.length === 0 && (
        <p className="text-xs text-muted-foreground">Nichts gefunden. Felder unten einfach selbst ausfüllen.</p>
      )}

      {results.length > 0 && (
        <ul className="flex max-h-56 flex-col overflow-y-auto">
          {results.slice(0, MAX_VISIBLE_RESULTS).map((entry) => (
            <li key={entry.code}>
              <button
                type="button"
                onClick={() => {
                  onSelect(entry);
                  setQuery('');
                }}
                className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-muted"
              >
                <span
                  className="size-5 shrink-0 rounded-full border border-black/15 dark:border-white/20"
                  style={{ background: toSwatchBackground(entry.colors) }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{entry.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{entry.productLine}</span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">{entry.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <BarcodeScanner isOpen={isScannerOpen} onOpenChange={setIsScannerOpen} onDetected={handleScan} />
    </div>
  );
}

/** Mehrfarbige Filamente als Kreisausschnitte darstellen */
export function toSwatchBackground(colors: readonly string[]): string {
  if (colors.length <= 1) return colors[0] ?? 'var(--muted)';
  const step = 360 / colors.length;
  const stops = colors.map((color, index) => `${color} ${index * step}deg ${(index + 1) * step}deg`);
  return `conic-gradient(${stops.join(', ')})`;
}
