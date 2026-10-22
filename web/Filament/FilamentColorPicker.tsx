import { PrinterIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { usePrinterStatus } from '../Printer/usePrinterStatus';
import { toFilamentOptions, type FilamentOption } from './filamentOptions';
import { useFilaments } from './useFilaments';

/** Farbverlauf für die Option "Farbe egal" */
const ANY_COLOR_SWATCH = 'conic-gradient(#ef4444, #f59e0b, #22c55e, #3b82f6, #a855f7, #ef4444)';

/** Feste Vorschläge, falls weder Drucker noch Bibliothek Farben liefern */
const FALLBACK_OPTIONS: readonly FilamentOption[] = [
  ['Schwarz', '#18181B'],
  ['Weiß', '#FAFAFA'],
  ['Grau', '#9CA3AF'],
  ['Rot', '#EF4444'],
  ['Orange', '#F97316'],
  ['Gelb', '#FACC15'],
  ['Grün', '#22C55E'],
  ['Blau', '#3B82F6'],
  ['Lila', '#A855F7'],
  ['Pink', '#EC4899'],
].map(([name = '', colorHex = '']) => ({ key: name, name, colorHex, material: '', isLoaded: false, slot: null, value: name }));

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
}

export function FilamentColorPicker({ id, value, onChange }: Props) {
  const printer = usePrinterStatus();
  const { filaments } = useFilaments();

  const isLoading = filaments === null || printer === null;
  const options = toFilamentOptions(printer?.amsTrays ?? [], filaments ?? []);
  const loadedOptions = options.filter((option) => option.isLoaded);
  const libraryOptions = options.filter((option) => !option.isLoaded);
  const hasRealOptions = options.length > 0;
  const normalizedValue = value.trim().toLocaleLowerCase('de-DE');

  const renderChip = (option: FilamentOption) => (
    <ColorChip
      key={option.key}
      label={option.name}
      detail={option.material}
      swatch={option.colorHex}
      isSelected={normalizedValue === option.value.toLocaleLowerCase('de-DE')}
      onSelect={() => onChange(option.value)}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      {isLoading && <Skeleton className="h-7 w-full" />}

      {!isLoading && loadedOptions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <PrinterIcon className="size-3" /> Gerade im Drucker, sofort druckbar
          </span>
          <div className="flex flex-wrap gap-1.5">{loadedOptions.map(renderChip)}</div>
        </div>
      )}

      {!isLoading && (
        <div className="flex flex-col gap-1.5">
          {loadedOptions.length > 0 && libraryOptions.length > 0 && (
            <span className="text-xs text-muted-foreground">Weitere Spulen</span>
          )}
          <div className="flex flex-wrap gap-1.5">
            <ColorChip
              label="Egal"
              detail=""
              swatch={ANY_COLOR_SWATCH}
              isSelected={normalizedValue === ''}
              onSelect={() => onChange('')}
            />
            {(hasRealOptions ? libraryOptions : FALLBACK_OPTIONS).map(renderChip)}
          </div>
        </div>
      )}

      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Oder eigene Farbe, z.B. Silk Gold"
      />
    </div>
  );
}

interface ColorChipProps {
  label: string;
  detail: string;
  swatch: string;
  isSelected: boolean;
  onSelect: () => void;
}

function ColorChip({ label, detail, swatch, isSelected, onSelect }: ColorChipProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors hover:bg-muted',
        isSelected && 'border-primary bg-primary/10 ring-1 ring-primary',
      )}
    >
      <span className="size-3.5 shrink-0 rounded-full border border-black/15 dark:border-white/20" style={{ background: swatch }} />
      <span className="font-medium">{label}</span>
      {detail !== '' && <span className="text-muted-foreground">{detail}</span>}
    </button>
  );
}
