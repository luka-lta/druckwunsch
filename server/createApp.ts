import { Hono } from 'hono';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import type { AppDependencies } from './AppDependencies';
import type { AppEnv } from './AppEnv';
import { createAuthRoutes } from './Auth/authRoutes';
import { createCatalogRoutes } from './Filament/Catalog/catalogRoutes';
import { createFilamentRoutes } from './Filament/filamentRoutes';
import { createPrinterRoutes } from './Printer/printerRoutes';
import { createPrintRequestRoutes } from './PrintRequest/printRequestRoutes';
import { createStatisticsRoutes } from './Statistics/statisticsRoutes';

export function createApp(deps: AppDependencies): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use('*', secureHeaders());
  app.use('/api/*', csrf());

  // Für den Docker-Healthcheck, ohne Anmeldung
  // Usage: curl /api/health
  app.get('/api/health', (c) => c.json({ status: 'ok' }));

  app.route('/api', createAuthRoutes(deps));
  app.route('/api', createPrintRequestRoutes(deps));
  app.route('/api', createPrinterRoutes(deps));
  app.route('/api', createFilamentRoutes(deps));
  app.route('/api', createCatalogRoutes(deps));
  app.route('/api', createStatisticsRoutes(deps));
  app.all('/api/*', (c) => c.json({ error: 'Nicht gefunden' }, 404));

  app.onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse();
    console.error('Unhandled request error', { path: c.req.path, error });
    return c.json({ error: 'Interner Fehler' }, 500);
  });

  return app;
}
