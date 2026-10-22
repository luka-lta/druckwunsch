import { Hono } from 'hono';
import type { AppDependencies } from '../AppDependencies';
import type { AppEnv } from '../AppEnv';
import { requireAdmin, requireSession } from '../Auth/sessionMiddleware';
import { computeStatistics } from './Statistics';

export function createStatisticsRoutes(deps: AppDependencies): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  // Usage: curl /api/statistics --cookie 'druckwunsch_session=<token>'
  routes.get('/statistics', requireSession(deps.sessions, deps.now), requireAdmin, (c) => {
    const statistics = computeStatistics(
      deps.printRequests.loadAllPrintRequests(),
      deps.filaments.loadAllFilaments(),
      deps.printJobRepository.loadTotalFilamentGrams(),
      deps.now(),
      deps.catalog,
    );
    return c.json(statistics);
  });

  return routes;
}
