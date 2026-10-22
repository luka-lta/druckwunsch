import { parseMakerWorldLink } from './MakerWorldLink';
import type { ModelPreviewLoader } from './ModelPreview';
import type { PrintRequestRepository } from './Repository/PrintRequestRepository';

/**
 * Lädt Titel und Bild für Wünsche nach, bei denen das beim Anlegen nicht geklappt hat.
 * Gibt die Anzahl der reparierten Wünsche zurück.
 */
export async function refreshMissingPreviews(
printRequests: PrintRequestRepository,
loadPreview: ModelPreviewLoader,
): Promise<number> {
  let refreshedCount = 0;

  // Nacheinander statt parallel, um MakerWorld nicht mit vielen Anfragen auf einmal zu belasten
  for (const request of printRequests.loadPrintRequestsWithoutImage()) {
    const link = parseMakerWorldLink(request.url);
    if (link === null) continue;

    const preview = await loadPreview(link);
    if (preview.imageUrl === null) continue;

    // Selbst eingegebene Titel bleiben erhalten, nur der Platzhalter aus der URL wird ersetzt
    const title = request.title === link.fallbackTitle ? preview.title : request.title;
    printRequests.updatePreview(request.id, { title, imageUrl: preview.imageUrl });
    refreshedCount++;
  }

  return refreshedCount;
}
