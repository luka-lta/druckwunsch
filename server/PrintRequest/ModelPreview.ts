import type { MakerWorldLink } from './MakerWorldLink';

/** Maximale Wartezeit für den Abruf der Modelldaten: 5 Sekunden */
const FETCH_TIMEOUT_MS = 5_000;

/** Maximale Titellänge, damit ein kaputter Titel das Layout nicht sprengt */
export const MAX_TITLE_LENGTH = 150;

// Inoffizieller JSON-Endpunkt, den auch die MakerWorld-Website nutzt
const DESIGN_API_URL = 'https://makerworld.com/api/v1/design-service/design/';

// Bewusst ohne "Accept: application/json": Mit diesem Header antwortet MakerWorld mit 403.
const REQUEST_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; Druckwunsch/0.1)' };

export interface ModelPreview {
  readonly title: string;
  readonly imageUrl: string | null;
}

export type ModelPreviewLoader = (link: MakerWorldLink) => Promise<ModelPreview>;

/**
 * Erzeugt einen Loader für Titel und Vorschaubild eines Modells.
 * Schlägt der Abruf fehl, wird der aus der URL abgeleitete Titel ohne Bild verwendet.
 */
export function createModelPreviewLoader(fetchFunction: typeof fetch = fetch): ModelPreviewLoader {
  return async (link) => {
    const fallback: ModelPreview = { title: link.fallbackTitle, imageUrl: null };
    const design = await loadDesign(fetchFunction, link.modelId);
    if (design === null) return fallback;

    const preview = parseDesignResponse(design);
    return {
      title: preview.title ?? fallback.title,
      imageUrl: preview.imageUrl,
    };
  };
}

async function loadDesign(fetchFunction: typeof fetch, modelId: string): Promise<unknown> {
  try {
    const response = await fetchFunction(`${DESIGN_API_URL}${encodeURIComponent(modelId)}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: REQUEST_HEADERS,
    });
    if (!response.ok) {
      console.warn('Failed to load model preview', { modelId, status: response.status });
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn('Failed to load model preview', { modelId, reason: String(error) });
    return null;
  }
}

export interface DesignPreview {
  readonly title: string | null;
  readonly imageUrl: string | null;
}

export function parseDesignResponse(design: unknown): DesignPreview {
  if (typeof design !== 'object' || design === null) return { title: null, imageUrl: null };
  const fields = design as Record<string, unknown>;
  return {
    title: parseTitle(fields.titleTranslated) ?? parseTitle(fields.title),
    imageUrl: parseImageUrl(fields.coverUrl),
  };
}

function parseTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const title = value.trim().replace(/\s+/g, ' ');
  if (title === '') return null;
  return [...title].slice(0, MAX_TITLE_LENGTH).join('');
}

// Nur HTTPS-Bilder übernehmen, damit keine beliebigen Schemata (javascript:, data:) im Frontend landen.
function parseImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}
