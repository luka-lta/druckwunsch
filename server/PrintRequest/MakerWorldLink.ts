const ALLOWED_HOSTS = new Set(['makerworld.com', 'www.makerworld.com']);

// Beispiele: /de/models/123456-handyhalter, /models/123456, /en-us/models/123456-foo/
const MODEL_PATH_PATTERN = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?models\/(\d+)(?:-([^/]+))?\/?$/i;

// MakerWorld hängt das gewählte Druckprofil als Fragment an, z.B. #profileId-987654
const PROFILE_FRAGMENT_PATTERN = /^#profileId-\d+$/;

// Findet einen MakerWorld-Link in einem Teilen-Text wie "Schau dir das an: https://makerworld.com/…"
const EMBEDDED_URL_PATTERN = /https?:\/\/(?:www\.)?makerworld\.com\/[^\s"'<>]+/i;

// Satzzeichen, die beim Kopieren aus Texten oft direkt am Link hängen
const TRAILING_PUNCTUATION_PATTERN = /[.,;:!?)\]]+$/;

/** Geprüfter und normalisierter Link auf ein MakerWorld-Modell */
export interface MakerWorldLink {
  readonly modelId: string;
  readonly url: string;
  /** Aus der URL abgeleiteter Titel, falls die Seite nicht abgerufen werden kann */
  readonly fallbackTitle: string;
}

/** Akzeptiert einen reinen Link oder einen Text, der einen MakerWorld-Link enthält */
export function parseMakerWorldLink(input: string): MakerWorldLink | null {
  const directLink = parseModelUrl(input.trim());
  if (directLink !== null) return directLink;

  const embeddedUrl = EMBEDDED_URL_PATTERN.exec(input)?.[0];
  if (embeddedUrl === undefined) return null;
  return parseModelUrl(embeddedUrl.replace(TRAILING_PUNCTUATION_PATTERN, ''));
}

function parseModelUrl(input: string): MakerWorldLink | null {
  const parsedUrl = parseUrl(input);
  if (parsedUrl === null) return null;
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') return null;
  if (!ALLOWED_HOSTS.has(parsedUrl.hostname.toLowerCase())) return null;

  const match = MODEL_PATH_PATTERN.exec(parsedUrl.pathname);
  if (match === null) return null;

  const modelId = match[1] ?? '';
  const slug = match[2] ?? '';
  const slugSuffix = slug === '' ? '' : `-${slug}`;
  const fragment = PROFILE_FRAGMENT_PATTERN.test(parsedUrl.hash) ? parsedUrl.hash : '';

  return {
    modelId,
    url: `https://makerworld.com/de/models/${modelId}${slugSuffix}${fragment}`,
    fallbackTitle: toTitleFromSlug(slug, modelId),
  };
}

function parseUrl(input: string): URL | null {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

function toTitleFromSlug(slug: string, modelId: string): string {
  const words = decodeSlug(slug).replace(/[-_]+/g, ' ').trim();
  if (words === '') return `Modell ${modelId}`;
  return words.charAt(0).toLocaleUpperCase('de-DE') + words.slice(1);
}

function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}
