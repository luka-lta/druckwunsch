import { useEffect, useState, type FormEvent } from 'react';
import { Loader2Icon } from 'lucide-react';
import type { FilamentRequest } from '../../shared/api';
import { parseColorHex } from '../../shared/ColorHex';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CatalogPicker } from './CatalogPicker';

const MATERIAL_SUGGESTIONS = ['PLA', 'PLA Matte', 'PLA Silk', 'PLA-CF', 'PETG', 'ABS', 'ASA', 'TPU'];

interface Props {
  isOpen: boolean;
  title: string;
  /** Startwerte; bei "Neu" leer, bei "Bearbeiten" die bestehende Spule */
  initial: FilamentRequest;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (input: FilamentRequest) => Promise<void>;
}

export function FilamentDialog({ isOpen, title, initial, onOpenChange, onSubmit }: Props) {
  const [name, setName] = useState(initial.name);
  const [material, setMaterial] = useState(initial.material);
  const [colorHex, setColorHex] = useState(initial.colorHex);
  const [isAvailable, setIsAvailable] = useState(initial.isAvailable);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Beim Öffnen mit neuen Startwerten (z.B. andere Spule) das Formular zurücksetzen
  useEffect(() => {
    if (!isOpen) return;
    setName(initial.name);
    setMaterial(initial.material);
    setColorHex(initial.colorHex);
    setIsAvailable(initial.isAvailable);
  }, [isOpen, initial]);

  const parsedColor = parseColorHex(colorHex);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (parsedColor === null) return;
    setIsSubmitting(true);
    try {
      await onSubmit({ name, material, colorHex: parsedColor, isAvailable });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Aus dem Bambu-Katalog wählen oder selbst ausfüllen. Erscheint im Wunsch-Formular, solange die Spule verfügbar ist.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <CatalogPicker
            onSelect={(entry) => {
              setName(entry.name);
              setMaterial(entry.productLine);
              setColorHex(entry.colorHex);
            }}
          />

          <div className="grid gap-2">
            <Label htmlFor="filament-name">Name</Label>
            <Input
              id="filament-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="z.B. Latte Brown"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="filament-material">Material</Label>
            <Input
              id="filament-material"
              value={material}
              onChange={(event) => setMaterial(event.target.value)}
              list="filament-material-suggestions"
              placeholder="z.B. PLA Matte"
              required
            />
            <datalist id="filament-material-suggestions">
              {MATERIAL_SUGGESTIONS.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="filament-color">Farbe</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Farbe wählen"
                value={parsedColor ?? '#000000'}
                onChange={(event) => setColorHex(event.target.value.toUpperCase())}
                className="h-8 w-12 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
              />
              <Input
                id="filament-color"
                value={colorHex}
                onChange={(event) => setColorHex(event.target.value)}
                aria-invalid={parsedColor === null}
                className="font-mono uppercase"
                placeholder="#AE835B"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor="filament-available">Verfügbar</Label>
              <p className="text-xs text-muted-foreground">Ausschalten, wenn die Spule leer ist.</p>
            </div>
            <Switch id="filament-available" checked={isAvailable} onCheckedChange={setIsAvailable} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting || parsedColor === null}>
              {isSubmitting && <Loader2Icon className="animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
