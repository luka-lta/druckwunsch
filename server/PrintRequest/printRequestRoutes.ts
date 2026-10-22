import { Hono } from 'hono';
import type { PreviewResponse, PrintRequestResponse, PrintRequestStatus } from '../../shared/api';
import type { AppDependencies } from '../AppDependencies';
import type { AppEnv } from '../AppEnv';
import type { Session } from '../Auth/Session';
import { requireAdmin, requireSession } from '../Auth/sessionMiddleware';
import { parseMakerWorldLink } from './MakerWorldLink';
import { parsePrintRequestInput, parsePrintRequestUpdate } from './PrintRequestInput';
import type { PrintRequest, PrintRequestId } from './Repository/PrintRequestRepository';

export function createPrintRequestRoutes(deps: AppDependencies): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  // Middleware pro Route statt routes.use('*'), da sie sonst beim Einhängen unter /api auch den Login träfe.
  const withSession = requireSession(deps.sessions, deps.now);

  // Admins sehen alle Wünsche, alle anderen nur ihre eigenen.
  // Usage: curl /api/requests --cookie 'druckwunsch_session=<token>'
  routes.get('/requests', withSession, (c) => {
    const session = c.get('session');
    // Gemerkte Modelle sieht nur die Person selbst, auch Admins nicht
    const printRequests = session.role === 'admin'
      ? deps.printRequests.loadAllPrintRequests()
        .filter((request) => request.status !== 'saved' || request.userId === session.userId)
      : deps.printRequests.loadPrintRequestsByUser(session.userId);
    return c.json(printRequests.map((printRequest) => toResponse(printRequest, session)));
  });

  // Usage: curl -X POST /api/requests --cookie 'druckwunsch_session=<token>' --header 'Content-Type: application/json'
  //     --data '{"url":"https://makerworld.com/de/models/123456","color":"Schwarz","quantity":1,"note":""}'
  routes.post('/requests', withSession, async (c) => {
    const session = c.get('session');
    const body: unknown = await c.req.json().catch(() => null);
    const input = parsePrintRequestInput(body);
    if (!input.isOk) return c.json({ error: input.error }, 400);

    const preview = await deps.loadPreview(input.value.link);
    const title = choosePreferredTitle(input.value.title, preview.title, input.value.link.fallbackTitle);
    const id = deps.printRequests.createPrintRequest(
      session.userId,
      input.value,
      { title, imageUrl: preview.imageUrl },
      deps.now(),
    );
    const printRequest = deps.printRequests.loadPrintRequest(id);
    if (printRequest === null) return c.json({ error: 'Wunsch konnte nicht gespeichert werden' }, 500);
    return c.json(toResponse(printRequest, session), 201);
  });

  // Usage: curl -X PATCH /api/requests/42 --cookie 'druckwunsch_session=<token>'
  //     --header 'Content-Type: application/json' --data '{"status":"printing","isUrgent":true}'
  routes.patch('/requests/:id', withSession, requireAdmin, async (c) => {
    const session = c.get('session');
    const id = parseId(c.req.param('id'));
    if (id === null) return c.json({ error: 'Wunsch nicht gefunden' }, 404);

    const update = parsePrintRequestUpdate(await c.req.json().catch(() => null));
    if (!update.isOk) return c.json({ error: update.error }, 400);

    if (deps.printRequests.loadPrintRequest(id) === null) return c.json({ error: 'Wunsch nicht gefunden' }, 404);
    if (update.value.status !== null) {
      deps.printRequests.updateStatus(id, update.value.status, deps.now());
      updatePrintJobLink(deps, id, update.value.status);
    }
    if (update.value.isUrgent !== null) deps.printRequests.setUrgent(id, update.value.isUrgent, deps.now());

    const updated = deps.printRequests.loadPrintRequest(id);
    if (updated === null) return c.json({ error: 'Wunsch nicht gefunden' }, 404);
    return c.json(toResponse(updated, session));
  });

  // Gemerktes Modell als Wunsch abschicken; nur durch die Person, die es gemerkt hat
  // Usage: curl -X POST /api/requests/42/submit --cookie 'druckwunsch_session=<token>'
  routes.post('/requests/:id/submit', withSession, (c) => {
    const session = c.get('session');
    const id = parseId(c.req.param('id'));
    const printRequest = id === null ? null : deps.printRequests.loadPrintRequest(id);
    if (id === null || printRequest === null || printRequest.userId !== session.userId) {
      return c.json({ error: 'Wunsch nicht gefunden' }, 404);
    }
    if (!deps.printRequests.submitSavedRequest(id, deps.now())) {
      return c.json({ error: 'Der Wunsch ist schon abgeschickt' }, 409);
    }

    const submitted = deps.printRequests.loadPrintRequest(id);
    if (submitted === null) return c.json({ error: 'Wunsch nicht gefunden' }, 404);
    return c.json(toResponse(submitted, session));
  });

  // Usage: curl -X PUT /api/requests/order --cookie 'druckwunsch_session=<token>'
  //     --header 'Content-Type: application/json' --data '{"ids":[42,17,23]}'
  routes.put('/requests/order', withSession, requireAdmin, async (c) => {
    const ids = parseIdList((await c.req.json().catch(() => null) as Record<string, unknown> | null)?.ids);
    if (ids === null) return c.json({ error: 'Ungültige Reihenfolge' }, 400);

    deps.printRequests.updateOrder(ids);
    return c.body(null, 204);
  });

  // Eigene Wünsche dürfen zurückgezogen werden, solange sie noch nicht angenommen wurden.
  // Fremde Wünsche liefern 404, damit ihre Existenz nicht verraten wird.
  // Usage: curl -X DELETE /api/requests/42 --cookie 'druckwunsch_session=<token>'
  routes.delete('/requests/:id', withSession, (c) => {
    const session = c.get('session');
    const id = parseId(c.req.param('id'));
    if (id === null) return c.json({ error: 'Wunsch nicht gefunden' }, 404);

    const printRequest = deps.printRequests.loadPrintRequest(id);
    if (printRequest === null) return c.json({ error: 'Wunsch nicht gefunden' }, 404);

    const isAdmin = session.role === 'admin';
    if (!isAdmin && printRequest.userId !== session.userId) return c.json({ error: 'Wunsch nicht gefunden' }, 404);
    if (!isAdmin && printRequest.status !== 'new' && printRequest.status !== 'saved') {
      return c.json({ error: 'Der Wunsch wurde schon angenommen und kann nicht mehr zurückgezogen werden' }, 409);
    }

    deps.printRequests.deletePrintRequest(id);
    return c.body(null, 204);
  });

  // Usage: curl '/api/preview?url=https%3A%2F%2Fmakerworld.com%2Fde%2Fmodels%2F123456' --cookie 'druckwunsch_session=<token>'
  routes.get('/preview', withSession, async (c) => {
    const link = parseMakerWorldLink(c.req.query('url') ?? '');
    if (link === null) return c.json({ error: 'Kein gültiger MakerWorld-Link' }, 400);

    const preview = await deps.loadPreview(link);
    const response: PreviewResponse = { url: link.url, title: preview.title, imageUrl: preview.imageUrl };
    return c.json(response);
  });

  return routes;
}

/**
 * Ein selbst eingegebener Titel gewinnt. Entspricht er nur dem Platzhalter aus der URL
 * (z.B. "Modell 701373"), wird der von MakerWorld geladene Titel bevorzugt.
 */
export function choosePreferredTitle(userTitle: string | null, loadedTitle: string, fallbackTitle: string): string {
  if (userTitle === null || userTitle === fallbackTitle) return loadedTitle;
  return userTitle;
}

/** Höchstzahl an IDs pro Reihenfolge-Anfrage */
const MAX_ORDER_IDS = 500;

function parseIdList(value: unknown): PrintRequestId[] | null {
  if (!Array.isArray(value) || value.length > MAX_ORDER_IDS) return null;
  const ids = value.filter((id): id is number => Number.isSafeInteger(id) && id > 0);
  if (ids.length !== value.length || new Set(ids).size !== ids.length) return null;
  return ids as PrintRequestId[];
}

function parseId(value: string): PrintRequestId | null {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? (id as PrintRequestId) : null;
}

function toResponse(printRequest: PrintRequest, session: Session): PrintRequestResponse {
  return {
    id: printRequest.id,
    requesterName: printRequest.requesterName,
    isOwn: printRequest.userId === session.userId,
    url: printRequest.url,
    title: printRequest.title,
    imageUrl: printRequest.imageUrl,
    color: printRequest.color,
    quantity: printRequest.quantity,
    note: printRequest.note,
    status: printRequest.status,
    createdAt: printRequest.createdAt,
    updatedAt: printRequest.updatedAt,
    printJobName: printRequest.printJobName,
    filamentGrams: printRequest.filamentGrams,
    isUrgent: printRequest.isUrgent,
  };
}

/**
 * "Druckt" verknüpft den Wunsch mit dem laufenden Druck. Läuft noch keiner, übernimmt der nächste
 * gestartete Druck den Wunsch. Zurück in die Warteschlange gelegte Wünsche verlieren die Verknüpfung.
 */
function updatePrintJobLink(deps: AppDependencies, id: PrintRequestId, status: PrintRequestStatus): void {
  if (status === 'printing') {
    deps.printRequests.setPrintJob(id, deps.printJobs?.getActiveJobId() ?? null);
    return;
  }
  if (status === 'new' || status === 'accepted' || status === 'rejected') deps.printRequests.setPrintJob(id, null);
}
