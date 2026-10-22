import { Hono } from 'hono';
import type { PrinterStatusResponse } from '../../shared/api';
import type { AppDependencies } from '../AppDependencies';
import type { AppEnv } from '../AppEnv';
import { requireSession } from '../Auth/sessionMiddleware';
import type { FilamentCatalog } from '../Filament/Catalog/BambuCatalog';
import type { PrinterStatus } from './PrinterStatus';

const DISABLED_RESPONSE: PrinterStatusResponse = {
  isEnabled: false,
  isConnected: false,
  state: 'offline',
  progressPercent: null,
  remainingMinutes: null,
  jobName: null,
  currentLayer: null,
  totalLayers: null,
  nozzleTemperature: null,
  bedTemperature: null,
  updatedAt: null,
  amsTrays: [],
};

export function createPrinterRoutes(deps: AppDependencies): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  // Usage: curl /api/printer --cookie 'druckwunsch_session=<token>'
  routes.get('/printer', requireSession(deps.sessions, deps.now), (c) => {
    if (deps.printer === null) return c.json(DISABLED_RESPONSE);
    return c.json(toResponse(deps.printer.getStatus(), deps.catalog));
  });

  return routes;
}

function toResponse(status: PrinterStatus, catalog: FilamentCatalog): PrinterStatusResponse {
  return {
    isEnabled: true,
    isConnected: status.isConnected,
    state: status.state,
    progressPercent: status.progressPercent,
    remainingMinutes: status.remainingMinutes,
    jobName: status.jobName,
    currentLayer: status.currentLayer,
    totalLayers: status.totalLayers,
    nozzleTemperature: status.nozzleTemperature,
    bedTemperature: status.bedTemperature,
    updatedAt: status.updatedAt,
    amsTrays: status.amsTrays.map((tray) => {
      const catalogEntry = catalog.findByTray(tray.trayInfoIdx, tray.trayIdName);
      return {
        slot: tray.slot,
        colorHex: tray.colorHex,
        material: tray.material,
        subBrand: tray.subBrand,
        remainPercent: tray.remainPercent,
        catalogName: catalogEntry?.name ?? null,
        catalogCode: catalogEntry?.code ?? null,
      };
    }),
  };
}
