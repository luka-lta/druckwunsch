// Startet Druckwunsch mit Beispieldaten und einem simulierten Drucker – zum Ausprobieren ohne
// eigenen Bambu-Drucker und für die Screenshots in der README. Es wird nichts dauerhaft gespeichert.
// Usage: npm run demo
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import type { PrintRequestStatus } from '../shared/api';
import { parseColorHex, type ColorHex } from '../shared/ColorHex';
import { LoginRateLimiter } from '../server/Auth/LoginRateLimiter';
import { SessionRepository } from '../server/Auth/Repository/SessionRepository';
import { UserRepository } from '../server/Auth/Repository/UserRepository';
import { parseUserName, type UserId } from '../server/Auth/Session';
import { createApp } from '../server/createApp';
import { openDatabase } from '../server/Database';
import { BambuCatalog } from '../server/Filament/Catalog/BambuCatalog';
import { FilamentRepository } from '../server/Filament/Repository/FilamentRepository';
import type { AmsTray } from '../server/Printer/AmsTray';
import { PrintJobRepository } from '../server/Printer/PrintJob/PrintJobRepository';
import type { PrinterStatus } from '../server/Printer/PrinterStatus';
import { parseMakerWorldLink } from '../server/PrintRequest/MakerWorldLink';
import { PrintRequestRepository } from '../server/PrintRequest/Repository/PrintRequestRepository';
import { createExpoPushSender } from '../server/Notification/ExpoPushClient';
import { PushNotifier } from '../server/Notification/PushNotifier';
import { PushTokenRepository } from '../server/Notification/Repository/PushTokenRepository';

/** Port des Demo-Servers, getrennt vom normalen Entwicklungsserver */
const DEMO_PORT = Number(process.env.DEMO_PORT ?? 3200);

const FAMILY_CODE = 'demo-familie';
const ADMIN_CODE = 'demo-admin';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Name des simulierten laufenden Drucks; ein Demo-Wunsch ist damit verknüpft */
const RUNNING_JOB_NAME = 'Kabelclip-Set';

type Shape = 'cube' | 'vase' | 'flat' | 'tower';

interface DemoRequest {
  readonly requester: string;
  readonly title: string;
  readonly shape: Shape;
  readonly imageColor: string;
  readonly color: string;
  readonly quantity: number;
  readonly status: PrintRequestStatus;
  readonly daysAgo: number;
  readonly note?: string;
  readonly isUrgent?: boolean;
  /** Filamentverbrauch für bereits gedruckte Wünsche */
  readonly grams?: number;
}

const DEMO_REQUESTS: readonly DemoRequest[] = [
  {
    requester: 'Oma',
    title: 'Brillenhalter Eule',
    shape: 'tower',
    imageColor: '#AE835B',
    color: 'Karamell (PLA Matte)',
    quantity: 1,
    status: 'new',
    daysAgo: 0,
    note: 'Für den Nachttisch',
  },
  {
    requester: 'Ben',
    title: 'Würfelturm mit Burg',
    shape: 'tower',
    imageColor: '#5B6579',
    color: '',
    quantity: 1,
    status: 'new',
    daysAgo: 1,
  },
  {
    requester: 'Lea',
    title: 'Flexi-Drache',
    shape: 'cube',
    imageColor: '#00AE42',
    color: 'Bambusgrün (PLA Basic)',
    quantity: 2,
    status: 'new',
    daysAgo: 1,
    isUrgent: true,
    note: 'Bis Samstag zum Geburtstag 🎂',
  },
  {
    requester: 'Papa',
    title: 'Gridfinity Box 2×3',
    shape: 'cube',
    imageColor: '#161616',
    color: 'Kohlschwarz (PLA Matte)',
    quantity: 4,
    status: 'accepted',
    daysAgo: 3,
  },
  {
    requester: 'Mama',
    title: 'Pflanzentopf mit Untersetzer',
    shape: 'vase',
    imageColor: '#E8E2D6',
    color: 'Jade-Weiß (PLA Basic)',
    quantity: 1,
    status: 'accepted',
    daysAgo: 4,
  },
  {
    requester: 'Opa',
    title: 'Werkzeughalter Lochwand',
    shape: 'flat',
    imageColor: '#161616',
    color: 'Kohlschwarz (PLA Matte)',
    quantity: 6,
    status: 'accepted',
    daysAgo: 5,
  },
  {
    requester: 'Mama',
    title: RUNNING_JOB_NAME,
    shape: 'flat',
    imageColor: '#E8E2D6',
    color: 'Jade-Weiß (PLA Basic)',
    quantity: 10,
    status: 'printing',
    daysAgo: 6,
  },
  {
    requester: 'Ben',
    title: 'Raketen-Schlüsselanhänger',
    shape: 'tower',
    imageColor: '#FF6A13',
    color: 'Orange (PLA Basic)',
    quantity: 3,
    status: 'done',
    daysAgo: 9,
    grams: 18,
  },
  {
    requester: 'Oma',
    title: 'Zahnbürstenhalter',
    shape: 'vase',
    imageColor: '#00AE42',
    color: 'Bambusgrün (PLA Basic)',
    quantity: 1,
    status: 'done',
    daysAgo: 12,
    grams: 64,
  },
  {
    requester: 'Lea',
    title: 'Stiftebecher Katze',
    shape: 'vase',
    imageColor: '#F55A74',
    color: 'Pink (PLA Basic)',
    quantity: 1,
    status: 'collected',
    daysAgo: 25,
    grams: 82,
  },
  {
    requester: 'Papa',
    title: 'Kabelkanal Schreibtisch',
    shape: 'flat',
    imageColor: '#161616',
    color: 'Kohlschwarz (PLA Matte)',
    quantity: 2,
    status: 'collected',
    daysAgo: 38,
    grams: 120,
  },
  {
    requester: 'Opa',
    title: 'Ersatzknopf Radio',
    shape: 'cube',
    imageColor: '#8E9089',
    color: 'Grau (PLA Basic)',
    quantity: 1,
    status: 'collected',
    daysAgo: 55,
    grams: 6,
  },
  {
    requester: 'Ben',
    title: 'Dino-Skelett Bausatz',
    shape: 'tower',
    imageColor: '#E8E2D6',
    color: 'Jade-Weiß (PLA Basic)',
    quantity: 1,
    status: 'collected',
    daysAgo: 70,
    grams: 145,
  },
  {
    requester: 'Mama',
    title: 'Gewürzregal-Einsatz',
    shape: 'flat',
    imageColor: '#AE835B',
    color: 'Karamell (PLA Matte)',
    quantity: 3,
    status: 'collected',
    daysAgo: 96,
    grams: 210,
  },
  {
    requester: 'Lea',
    title: 'Haarspangen-Set',
    shape: 'cube',
    imageColor: '#A3D8E1',
    color: 'Eisblau (PLA Basic)',
    quantity: 5,
    status: 'collected',
    daysAgo: 128,
    grams: 24,
  },
  {
    requester: 'Oma',
    title: 'Lupenhalter',
    shape: 'tower',
    imageColor: '#AE835B',
    color: 'Karamell (PLA Matte)',
    quantity: 1,
    status: 'collected',
    daysAgo: 160,
    grams: 48,
  },
  {
    requester: 'Papa',
    title: 'Wandhalter Akkuschrauber',
    shape: 'flat',
    imageColor: '#161616',
    color: 'Kohlschwarz (PLA Matte)',
    quantity: 1,
    status: 'collected',
    daysAgo: 190,
    grams: 95,
  },
  {
    requester: 'Ben',
    title: 'Fidget-Spinner',
    shape: 'cube',
    imageColor: '#0086D6',
    color: 'Cyan (PLA Basic)',
    quantity: 2,
    status: 'rejected',
    daysAgo: 20,
    note: 'Hast du schon drei 😉',
  },
  {
    requester: 'Oma',
    title: 'Teelichthalter Stern',
    shape: 'vase',
    imageColor: '#E8E2D6',
    color: '',
    quantity: 2,
    status: 'saved',
    daysAgo: 2,
  },
];

const DEMO_TRAYS: readonly AmsTray[] = [
  demoTray('A1', '#000000', 'PLA', 'PLA Matte', 40, 'GFA01', 'A01-K1'),
  demoTray('A2', '#00AE42', 'PLA', 'PLA Basic', 100, 'GFA00', 'A00-G6'),
  demoTray('A3', '#FFFFFF', 'PLA', 'PLA Basic', 58, 'GFA00', 'A00-W1'),
  demoTray('A4', '#AE835B', 'PLA', 'PLA Matte', 14, 'GFA01', 'A01-N3'),
];

function demoTray(
slot: string,
colorHex: string,
material: string,
subBrand: string,
remainPercent: number,
trayInfoIdx: string,
trayIdName: string,
): AmsTray {
  return {
    slot,
    colorHex: parseColorHex(colorHex),
    material,
    subBrand,
    remainPercent,
    trayInfoIdx,
    trayIdName,
    weightGrams: 1000,
  };
}

const DEMO_PRINTER_STATUS: PrinterStatus = {
  isConnected: true,
  state: 'printing',
  progressPercent: 63,
  remainingMinutes: 42,
  jobName: RUNNING_JOB_NAME,
  currentLayer: 118,
  totalLayers: 188,
  nozzleTemperature: 220,
  bedTemperature: 55,
  updatedAt: new Date().toISOString(),
  amsTrays: DEMO_TRAYS,
  jobKey: 'demo-job',
};

const dataDir = mkdtempSync(join(tmpdir(), 'druckwunsch-demo-'));
const database = openDatabase(':memory:');
const users = new UserRepository(database);
const printRequests = new PrintRequestRepository(database);
const printJobs = new PrintJobRepository(database);
const filaments = new FilamentRepository(database);
const catalog = new BambuCatalog(join(dataDir, 'bambu-filament-catalog.json'));

seed();

const runningJobId = printJobs.createPrintJob('demo-job', RUNNING_JOB_NAME, [], new Date());
for (const request of printRequests.loadAllPrintRequests()) {
  if (request.status === 'printing') printRequests.setPrintJob(request.id, runningJobId);
}

const pushTokens = new PushTokenRepository(database);
const pushNotifier = new PushNotifier(pushTokens, createExpoPushSender(null));

const app = createApp({
  config: {
    port: DEMO_PORT,
    familyCode: FAMILY_CODE,
    adminCode: ADMIN_CODE,
    dataDir,
    isCookieSecure: false,
    clientIpHeader: null,
    expoAccessToken: null,
  },
  users,
  sessions: new SessionRepository(database),
  printRequests,
  filaments,
  catalog,
  loginRateLimiter: new LoginRateLimiter(),
  // Keine Anfragen an MakerWorld: der Titel kommt aus dem Link
  loadPreview: async (link) => ({ title: link.fallbackTitle, imageUrl: null }),
  printer: { getStatus: () => ({ ...DEMO_PRINTER_STATUS, updatedAt: new Date().toISOString() }) },
  printJobs: { getActiveJobId: () => runningJobId },
  printJobRepository: printJobs,
  pushTokens,
  // Echte Mitteilungen, damit sich Push mit der App auch im Demo-Betrieb ausprobieren lässt
  notifyNewRequest: (request) => {
    pushNotifier.notifyNewRequest(request)
      .catch((error: unknown) => console.error('Failed to send push notification', { reason: String(error) }));
  },
  now: () => new Date(),
});

app.use('*', serveStatic({ root: './dist/web' }));
app.get('*', serveStatic({ path: './dist/web/index.html' }));

void catalog.start().then(() => catalog.stop());

serve({ fetch: app.fetch, port: DEMO_PORT }, (info) => {
  console.log(`\nDruckwunsch-Demo läuft auf http://127.0.0.1:${info.port}`);
  console.log(`  Familie: beliebiger Name + Code "${FAMILY_CODE}" (z.B. als "Oma")`);
  console.log(`  Admin:   beliebiger Name + Code "${ADMIN_CODE}"\n`);
});

function seed(): void {
  const now = Date.now();
  const userIds = new Map<string, UserId>();

  for (const demo of DEMO_REQUESTS) {
    const createdAt = new Date(now - demo.daysAgo * DAY_MS - DAY_MS / 3);
    const userId = userIds.get(demo.requester) ?? createUser(demo.requester, createdAt);
    userIds.set(demo.requester, userId);

    const link = parseMakerWorldLink(`https://makerworld.com/de/models/${100_000 + userIds.size * 1000 + demo.daysAgo}`);
    if (link === null) throw new Error('Invalid demo link');

    const id = printRequests.createPrintRequest(
      userId,
      { link, title: demo.title, color: demo.color, quantity: demo.quantity, note: demo.note ?? '', isSaved: demo.status === 'saved' },
      { title: demo.title, imageUrl: toDemoImage(demo.shape, demo.imageColor) },
      createdAt,
    );
    if (demo.status !== 'new' && demo.status !== 'saved') {
      printRequests.updateStatus(id, demo.status, new Date(createdAt.getTime() + DAY_MS));
    }
    if (demo.isUrgent === true) printRequests.setUrgent(id, true, createdAt);
    if (demo.grams !== undefined) {
      const jobId = printJobs.createPrintJob(`demo-${id}`, demo.title, [], createdAt);
      printJobs.finishPrintJob(jobId, 'finished', demo.grams, new Date(createdAt.getTime() + DAY_MS));
      printRequests.setPrintJob(id, jobId);
    }
  }

  filaments.createFilament({ name: 'Gold', material: 'PLA Silk', colorHex: '#E5B03D' as ColorHex, isAvailable: true }, new Date());
  filaments.createFilament({ name: 'Eisblau', material: 'PLA Basic', colorHex: '#A3D8E1' as ColorHex, isAvailable: true }, new Date());
  filaments.createFilament({ name: 'Pink', material: 'PLA Basic', colorHex: '#F55A74' as ColorHex, isAvailable: false }, new Date());
}

function createUser(name: string, createdAt: Date): UserId {
  const userName = parseUserName(name);
  if (userName === null) throw new Error(`Invalid demo user name: ${name}`);
  return users.loadOrCreateUser(userName, createdAt).id;
}

/** Schlichte Produktbilder als SVG, damit die Demo ohne fremde Bilder auskommt */
function toDemoImage(shape: Shape, color: string): string {
  const shapes: Record<Shape, string> = {
    cube: `<path d="M200 95 285 140v95l-85 45-85-45v-95z" fill="${color}"/>
      <path d="M200 95 285 140 200 185 115 140z" fill="#fff" fill-opacity=".28"/>
      <path d="M200 185v95l85-45v-95z" fill="#000" fill-opacity=".22"/>`,
    vase: `<ellipse cx="200" cy="270" rx="70" ry="18" fill="#000" fill-opacity=".18"/>
      <path d="M140 110h120l-15 150a45 18 0 0 1-90 0z" fill="${color}"/>
      <ellipse cx="200" cy="110" rx="60" ry="16" fill="#000" fill-opacity=".25"/>
      <path d="M150 120h18l-10 130h-14z" fill="#fff" fill-opacity=".25"/>`,
    flat: `<path d="M200 150 320 205 200 260 80 205z" fill="${color}"/>
      <path d="M80 205v20l120 55v-20z" fill="#000" fill-opacity=".2"/>
      <path d="M200 260v20l120-55v-20z" fill="#000" fill-opacity=".32"/>
      <path d="M200 175 265 205 200 235 135 205z" fill="#fff" fill-opacity=".2"/>`,
    tower: `<path d="M200 80 250 105v150l-50 25-50-25V105z" fill="${color}"/>
      <path d="M200 80 250 105 200 130 150 105z" fill="#fff" fill-opacity=".3"/>
      <path d="M200 130v150l50-25V105z" fill="#000" fill-opacity=".22"/>`,
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
    <defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f1ec"/><stop offset="1" stop-color="#dcd6cc"/></linearGradient></defs>
    <rect width="400" height="300" fill="url(#b)"/>${shapes[shape]}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
