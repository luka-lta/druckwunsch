import { useEffect, useState, type FormEvent } from 'react';
import { BookmarkIcon, CheckIcon, InfoIcon, Link2Icon, Loader2Icon, MinusIcon, PlusIcon, SendIcon, TriangleAlertIcon } from 'lucide-react';
import { toast } from 'sonner';
import { MAX_QUANTITY, type PreviewResponse, type PrintRequestResponse } from '../../shared/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { createPrintRequest, loadPreview } from '../apiClient';
import { FilamentColorPicker } from '../Filament/FilamentColorPicker';
import { ModelThumbnail } from './ModelThumbnail';

/** Wartezeit nach der letzten Eingabe, bevor die Vorschau geladen wird */
const PREVIEW_DEBOUNCE_MS = 500;

const MAKERWORLD_MODEL_HINT = /makerworld\.com\/.*models\/\d+/i;

type PreviewState =
  | { kind: 'empty' }
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'ready'; preview: PreviewResponse };

interface Props {
  onCreated: (request: PrintRequestResponse) => void;
  /** Zeigt zusätzlich "Merken", um das Modell nur auf die Merkliste zu setzen */
  isSaveAllowed?: boolean;
}

/** Wert des Absende-Knopfs, der nur merkt statt zu wünschen */
const SAVE_SUBMITTER = 'save';

/** Ergebnis eines Vorschau-Abrufs, gemerkt zusammen mit der Eingabe, für die es gilt */
type PreviewResult = { input: string; preview: PreviewResponse | null };

export function RequestForm({ onCreated, isSaveAllowed = false }: Props) {
  const [url, setUrl] = useState('');
  const [editedTitle, setEditedTitle] = useState<string | null>(null);
  const [color, setColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Nur das fertige Ergebnis landet im State. Lade- und Fehlerzustand werden aus der Eingabe abgeleitet,
  // damit beim Tippen keine zusätzlichen Renders entstehen (die haben Zeichen verschluckt).
  const trimmedUrl = url.trim();
  const isLinkLike = MAKERWORLD_MODEL_HINT.test(trimmedUrl);
  useEffect(() => {
    if (!isLinkLike) return;

    let isCurrent = true;
    const timeout = window.setTimeout(() => {
      loadPreview(trimmedUrl)
        .then((preview) => isCurrent && setPreviewResult({ input: trimmedUrl, preview }))
        .catch(() => isCurrent && setPreviewResult({ input: trimmedUrl, preview: null }));
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeout);
    };
  }, [trimmedUrl, isLinkLike]);

  const preview = toPreviewState(trimmedUrl, isLinkLike, previewResult);
  const title = editedTitle ?? (preview.kind === 'ready' ? preview.preview.title : '');

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setEditedTitle(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const isSaved = submitter?.value === SAVE_SUBMITTER;
    setIsSubmitting(true);
    try {
      const created = await createPrintRequest({ url, title, color, quantity, note, isSaved });
      onCreated(created);
      toast.success(isSaved ? 'Auf der Merkliste' : 'Wunsch abgeschickt', { description: created.title });
      handleUrlChange('');
      setColor('');
      setQuantity(1);
      setNote('');
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Speichern fehlgeschlagen');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="request-url">MakerWorld-Link</Label>
        <div className="relative">
          <Link2Icon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="request-url"
            inputMode="url"
            autoComplete="off"
            className="pl-8"
            value={url}
            onChange={(event) => handleUrlChange(event.target.value)}
            placeholder="Link oder Teilen-Text von MakerWorld"
            aria-invalid={preview.kind === 'invalid'}
            required
          />
        </div>
        <PreviewBox state={preview} title={title} onTitleChange={setEditedTitle} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="request-color">Farbe</Label>
        <FilamentColorPicker id="request-color" value={color} onChange={setColor} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="request-quantity">Anzahl</Label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setQuantity((current) => Math.max(1, current - 1))}
            disabled={quantity <= 1}
            aria-label="Weniger"
          >
            <MinusIcon />
          </Button>
          <Input
            id="request-quantity"
            type="number"
            min={1}
            max={MAX_QUANTITY}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            className="w-16 text-center"
            required
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setQuantity((current) => Math.min(MAX_QUANTITY, current + 1))}
            disabled={quantity >= MAX_QUANTITY}
            aria-label="Mehr"
          >
            <PlusIcon />
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="request-note">
          Notiz <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="request-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          placeholder="z.B. bis Samstag, etwas größer, …"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" size="lg" className="sm:flex-1" disabled={isSubmitting || preview.kind === 'invalid'}>
          {isSubmitting ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
          Wunsch abschicken
        </Button>
        {isSaveAllowed && (
          <Button
            type="submit"
            value={SAVE_SUBMITTER}
            size="lg"
            variant="outline"
            disabled={isSubmitting || preview.kind === 'invalid'}
          >
            <BookmarkIcon /> Merken
          </Button>
        )}
      </div>
    </form>
  );
}

function toPreviewState(input: string, isLinkLike: boolean, result: PreviewResult | null): PreviewState {
  if (input === '') return { kind: 'empty' };
  if (!isLinkLike) return { kind: 'invalid' };
  if (result === null || result.input !== input) return { kind: 'loading' };
  if (result.preview === null) return { kind: 'invalid' };
  return { kind: 'ready', preview: result.preview };
}

interface PreviewBoxProps {
  state: PreviewState;
  title: string;
  onTitleChange: (title: string) => void;
}

function PreviewBox({ state, title, onTitleChange }: PreviewBoxProps) {
  if (state.kind === 'empty') {
    return (
      <p className="text-xs text-muted-foreground">
        Auf MakerWorld beim Modell auf „Teilen“ tippen und den Link oder den ganzen Text hier einfügen.
      </p>
    );
  }

  if (state.kind === 'invalid') {
    return (
      <p className="inline-flex items-center gap-1.5 text-xs text-destructive">
        <TriangleAlertIcon className="size-3.5" /> Das sieht nicht nach einem MakerWorld-Modell aus.
      </p>
    );
  }

  if (state.kind === 'loading') {
    return (
      <div className="flex items-center gap-3 rounded-lg border p-2">
        <Skeleton className="size-12 rounded-md" />
        <Skeleton className="h-4 w-40" />
      </div>
    );
  }

  // Ohne Bild konnte MakerWorld nicht abgefragt werden; der Titel ist dann nur aus dem Link geraten
  const isGuessed = state.preview.imageUrl === null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-2">
      <div className="flex items-center gap-3">
        <ModelThumbnail imageUrl={state.preview.imageUrl} className="size-12 shrink-0" />
        <Input
          aria-label="Titel des Modells"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="Was ist das? z.B. Handyhalter"
          className="h-9 flex-1 bg-background font-medium"
        />
        {!isGuessed && <CheckIcon className="mr-1 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
      </div>
      {isGuessed && (
        <p className="inline-flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <InfoIcon className="size-3.5 shrink-0" />
          MakerWorld hat keine Details geliefert. Trag kurz ein, was es ist. Das Bild wird später nachgeladen.
        </p>
      )}
    </div>
  );
}
