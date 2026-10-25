import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { LoginRateLimiter } from './Auth/LoginRateLimiter';
import { SessionRepository } from './Auth/Repository/SessionRepository';
import { UserRepository } from './Auth/Repository/UserRepository';
import { parseConfig } from './Config';
import { createApp } from './createApp';
import { BambuCatalog } from './Filament/Catalog/BambuCatalog';
import { FilamentRepository } from './Filament/Repository/FilamentRepository';
import { openDatabase } from './Database';
import { createExpoPushSender } from './Notification/ExpoPushClient';
import { PushNotifier } from './Notification/PushNotifier';
import { PushTokenRepository } from './Notification/Repository/PushTokenRepository';
import { BambuPrinterClient } from './Printer/BambuPrinterClient';
import { PrintJobRepository } from './Printer/PrintJob/PrintJobRepository';
import { PrintJobTracker } from './Printer/PrintJob/PrintJobTracker';
import { parsePrinterConfig } from './Printer/PrinterConfig';
import { createModelPreviewLoader } from './PrintRequest/ModelPreview';
import { refreshMissingPreviews } from './PrintRequest/refreshMissingPreviews';
import { PrintRequestRepository } from './PrintRequest/Repository/PrintRequestRepository';

/** Verzeichnis des gebauten Frontends, relativ zum Arbeitsverzeichnis */
const WEB_ROOT = './dist/web';

const config = parseConfig(process.env);
mkdirSync(config.dataDir, { recursive: true });
const database = openDatabase(join(config.dataDir, 'druckwunsch.sqlite'));

const sessions = new SessionRepository(database);
sessions.deleteExpiredSessions(new Date());
const printRequests = new PrintRequestRepository(database);
const catalog = new BambuCatalog(join(config.dataDir, 'bambu-filament-catalog.json'));
catalog.start()
  .then(() => console.log('Filament catalog loaded', { entries: catalog.getEntryCount() }))
  .catch((error: unknown) => console.error('Failed to start filament catalog', { reason: String(error) }));
const loadPreview = createModelPreviewLoader();

const printerConfig = parsePrinterConfig(process.env);
const printJobRepository = new PrintJobRepository(database);
const printJobTracker = new PrintJobTracker(printJobRepository, printRequests, () => new Date(), {
  onRequestsCompleted: (requests) => {
    console.log('Print requests completed automatically', { requestIds: requests.map((request) => request.id) });
  },
});
const printer = printerConfig === null
  ? null
  : new BambuPrinterClient(printerConfig, (previous, current) => {
    console.log('Printer state changed', { previous, current });
    if (printer !== null) printJobTracker.handleStateChange(previous, current, printer.getStatus());
  });
printer?.start();

const pushTokens = new PushTokenRepository(database);
const pushNotifier = new PushNotifier(pushTokens, createExpoPushSender(config.expoAccessToken));

const app = createApp({
  config,
  users: new UserRepository(database),
  sessions,
  printRequests,
  filaments: new FilamentRepository(database),
  catalog,
  loginRateLimiter: new LoginRateLimiter(),
  loadPreview,
  printer,
  printJobs: printer === null ? null : printJobTracker,
  printJobRepository,
  pushTokens,
  notifyNewRequest: (request) => {
    pushNotifier.notifyNewRequest(request)
      .catch((error: unknown) => console.error('Failed to send push notification', { requestId: request.id, reason: String(error) }));
  },
  now: () => new Date(),
});

// Im Produktivbetrieb liefert der Server auch das gebaute Frontend aus.
app.use('*', serveStatic({ root: WEB_ROOT }));
app.get('*', serveStatic({ path: `${WEB_ROOT}/index.html` }));

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Druckwunsch läuft auf http://localhost:${info.port}`);
  console.log(printer === null ? 'Drucker-Anbindung aus' : `Drucker-Anbindung an ${printerConfig?.host}`);
});

/** Abstand zwischen Versuchen, fehlende Vorschaubilder nachzuladen: 6 Stunden */
const PREVIEW_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

// Wünsche ohne Bild im Hintergrund reparieren, sobald MakerWorld wieder antwortet
const refreshPreviews = () => {
  refreshMissingPreviews(printRequests, loadPreview)
    .then((count) => count > 0 && console.log('Refreshed missing previews', { count }))
    .catch((error: unknown) => console.error('Failed to refresh missing previews', { reason: String(error) }));
};
refreshPreviews();
const previewRefreshInterval = setInterval(refreshPreviews, PREVIEW_REFRESH_INTERVAL_MS);

process.on('SIGTERM', () => {
  clearInterval(previewRefreshInterval);
  catalog.stop();
  printer?.stop();
  database.close();
  process.exit(0);
});
