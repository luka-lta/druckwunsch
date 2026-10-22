import { Hono } from 'hono';
import type { FilamentResponse } from '../../shared/api';
import type { AppDependencies } from '../AppDependencies';
import type { AppEnv } from '../AppEnv';
import { requireAdmin, requireSession } from '../Auth/sessionMiddleware';
import { parseFilamentInput } from './FilamentInput';
import type { Filament, FilamentId } from './Repository/FilamentRepository';

export function createFilamentRoutes(deps: AppDependencies): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  const withSession = requireSession(deps.sessions, deps.now);

  // Die Familie sieht nur verfügbare Spulen, Admins die ganze Bibliothek.
  // Usage: curl /api/filaments --cookie 'druckwunsch_session=<token>'
  routes.get('/filaments', withSession, (c) => {
    const isAdmin = c.get('session').role === 'admin';
    const filaments = deps.filaments.loadAllFilaments().filter((filament) => isAdmin || filament.isAvailable);
    return c.json(filaments.map(toResponse));
  });

  // Usage: curl -X POST /api/filaments --cookie 'druckwunsch_session=<token>' --header 'Content-Type: application/json'
  //     --data '{"name":"Silk Gold","material":"PLA","colorHex":"#D4AF37","isAvailable":true}'
  routes.post('/filaments', withSession, requireAdmin, async (c) => {
    const input = parseFilamentInput(await c.req.json().catch(() => null));
    if (!input.isOk) return c.json({ error: input.error }, 400);

    const id = deps.filaments.createFilament(input.value, deps.now());
    const filament = deps.filaments.loadFilament(id);
    if (filament === null) return c.json({ error: 'Filament konnte nicht gespeichert werden' }, 500);
    return c.json(toResponse(filament), 201);
  });

  // Usage: curl -X PUT /api/filaments/3 --cookie 'druckwunsch_session=<token>' --header 'Content-Type: application/json'
  //     --data '{"name":"Silk Gold","material":"PLA","colorHex":"#D4AF37","isAvailable":false}'
  routes.put('/filaments/:id', withSession, requireAdmin, async (c) => {
    const id = parseId(c.req.param('id'));
    if (id === null || deps.filaments.loadFilament(id) === null) return c.json({ error: 'Filament nicht gefunden' }, 404);

    const input = parseFilamentInput(await c.req.json().catch(() => null));
    if (!input.isOk) return c.json({ error: input.error }, 400);

    deps.filaments.updateFilament(id, input.value, deps.now());
    const filament = deps.filaments.loadFilament(id);
    if (filament === null) return c.json({ error: 'Filament nicht gefunden' }, 404);
    return c.json(toResponse(filament));
  });

  // Usage: curl -X DELETE /api/filaments/3 --cookie 'druckwunsch_session=<token>'
  routes.delete('/filaments/:id', withSession, requireAdmin, (c) => {
    const id = parseId(c.req.param('id'));
    if (id === null || deps.filaments.loadFilament(id) === null) return c.json({ error: 'Filament nicht gefunden' }, 404);

    deps.filaments.deleteFilament(id);
    return c.body(null, 204);
  });

  return routes;
}

function parseId(value: string): FilamentId | null {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? (id as FilamentId) : null;
}

function toResponse(filament: Filament): FilamentResponse {
  return {
    id: filament.id,
    name: filament.name,
    material: filament.material,
    colorHex: filament.colorHex,
    isAvailable: filament.isAvailable,
  };
}
