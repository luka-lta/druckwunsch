import { Hono } from 'hono';
import type { CatalogEntryResponse } from '../../../shared/api';
import type { AppDependencies } from '../../AppDependencies';
import type { AppEnv } from '../../AppEnv';
import { requireAdmin, requireSession } from '../../Auth/sessionMiddleware';
import type { CatalogEntry } from './BambuCatalog';

export function createCatalogRoutes(deps: AppDependencies): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  const withAdmin = [requireSession(deps.sessions, deps.now), requireAdmin] as const;

  // Usage: curl '/api/filament-catalog?query=pla%20basic%20grün' --cookie 'druckwunsch_session=<token>'
  routes.get('/filament-catalog', ...withAdmin, (c) => {
    const entries = deps.catalog.search(c.req.query('query') ?? '');
    return c.json(entries.map(toCatalogEntryResponse));
  });

  // Usage: curl /api/filament-catalog/10501 --cookie 'druckwunsch_session=<token>'
  routes.get('/filament-catalog/:code', ...withAdmin, (c) => {
    const entry = deps.catalog.findByCode(c.req.param('code'));
    if (entry === null) return c.json({ error: 'Farbnummer nicht im Katalog' }, 404);
    return c.json(toCatalogEntryResponse(entry));
  });

  return routes;
}

export function toCatalogEntryResponse(entry: CatalogEntry): CatalogEntryResponse {
  return {
    code: entry.code,
    name: entry.name,
    productLine: entry.productLine,
    colorHex: entry.colors[0] ?? '#000000',
    colors: [...entry.colors],
  };
}
