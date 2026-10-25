import { beforeEach, describe, expect, it } from 'vitest';
import type { FilamentResponse, MeResponse, PrintRequestResponse } from '../shared/api';
import { LoginRateLimiter } from './Auth/LoginRateLimiter';
import { SessionRepository } from './Auth/Repository/SessionRepository';
import { UserRepository } from './Auth/Repository/UserRepository';
import type { ColorHex } from '../shared/ColorHex';
import type { Config } from './Config';
import { createApp } from './createApp';
import { BambuCatalog } from './Filament/Catalog/BambuCatalog';
import { PrintJobRepository } from './Printer/PrintJob/PrintJobRepository';
import { FilamentRepository } from './Filament/Repository/FilamentRepository';
import { openDatabase } from './Database';
import { PushTokenRepository } from './Notification/Repository/PushTokenRepository';
import { PrintRequestRepository, type PrintRequest } from './PrintRequest/Repository/PrintRequestRepository';

const CONFIG: Config = {
  port: 0,
  familyCode: 'family-secret',
  adminCode: 'admin-secret',
  dataDir: '',
  isCookieSecure: false,
  clientIpHeader: null,
  expoAccessToken: null,
};

const MODEL_URL = 'https://makerworld.com/de/models/123456-handyhalter';

const SILK_GOLD = { name: 'Silk Gold', material: 'PLA', colorHex: '#d4af37', isAvailable: true };

/** Header, den Browser bei Anfragen von derselben Origin mitsenden */
const SAME_ORIGIN = { 'Sec-Fetch-Site': 'same-origin' };

type App = ReturnType<typeof createApp>;

/** notifiedRequests sammelt die Wünsche, zu denen eine Push-Mitteilung ausgelöst wurde */
function createTestApp(config: Config = CONFIG, notifiedRequests: PrintRequest[] = []): App {
  const database = openDatabase(':memory:');
  return createApp({
    config,
    users: new UserRepository(database),
    sessions: new SessionRepository(database),
    printRequests: new PrintRequestRepository(database),
    filaments: new FilamentRepository(database),
    catalog: createTestCatalog(),
    loginRateLimiter: new LoginRateLimiter(),
    loadPreview: async (link) => ({ title: `Titel ${link.modelId}`, imageUrl: 'https://cdn.example.tld/a.jpg' }),
    printer: null,
    printJobs: null,
    printJobRepository: new PrintJobRepository(database),
    pushTokens: new PushTokenRepository(database),
    notifyNewRequest: (request) => notifiedRequests.push(request),
    now: () => new Date('2026-10-19T10:00:00Z'),
  });
}

async function login(app: App, name: string, code: string): Promise<string> {
  const response = await app.request('/api/login', jsonRequest('POST', { name, code }));
  expect(response.status).toBe(200);
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  if (cookie === undefined) throw new Error('Missing session cookie');
  return cookie;
}

function jsonRequest(method: string, body: unknown, cookie?: string): RequestInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie !== undefined) headers.Cookie = cookie;
  return { method, headers, body: JSON.stringify(body) };
}

function createTestCatalog(): BambuCatalog {
  const catalog = new BambuCatalog('');
  catalog.replaceEntries([
    { code: '10501', filamentId: 'GFA00', colorCode: 'G6', productLine: 'PLA Basic', name: 'Bambusgrün', colors: ['#00AE42' as ColorHex] },
    { code: '11101', filamentId: 'GFA01', colorCode: 'K1', productLine: 'PLA Matte', name: 'Kohlschwarz', colors: ['#000000' as ColorHex] },
  ]);
  return catalog;
}

function withHeaders(init: RequestInit, headers: Record<string, string>): RequestInit {
  return { ...init, headers: { ...(init.headers as Record<string, string>), ...headers } };
}

async function createRequest(app: App, cookie: string): Promise<PrintRequestResponse> {
  const response = await app.request(
    '/api/requests',
    jsonRequest('POST', { url: MODEL_URL, color: 'Rot', quantity: 1, note: '' }, cookie),
  );
  expect(response.status).toBe(201);
  return (await response.json()) as PrintRequestResponse;
}

describe('API', () => {
  let app: App;

  beforeEach(() => {
    app = createTestApp();
  });

  it('shouldAnswerHealthCheckWithoutSession', async () => {
    const response = await app.request('/api/health');

    expect(response.status).toBe(200);
  });

  it('shouldRejectLoginWithWrongCode', async () => {
    const response = await app.request('/api/login', jsonRequest('POST', { name: 'Mama', code: 'wrong-code' }));

    expect(response.status).toBe(401);
  });

  it('shouldRejectLoginWithoutName', async () => {
    const response = await app.request('/api/login', jsonRequest('POST', { name: '  ', code: CONFIG.familyCode }));

    expect(response.status).toBe(400);
  });

  it('shouldAssignRoleByCode', async () => {
    const familyCookie = await login(app, 'Mama', CONFIG.familyCode);
    const adminCookie = await login(app, 'Alex', CONFIG.adminCode);

    const family = (await (await app.request('/api/me', { headers: { Cookie: familyCookie } })).json()) as MeResponse;
    const admin = (await (await app.request('/api/me', { headers: { Cookie: adminCookie } })).json()) as MeResponse;

    expect(family).toEqual({ name: 'Mama', role: 'family' });
    expect(admin).toEqual({ name: 'Alex', role: 'admin' });
  });

  it('shouldTreatNamesCaseInsensitively', async () => {
    const firstCookie = await login(app, 'Mama', CONFIG.familyCode);
    await createRequest(app, firstCookie);
    const secondCookie = await login(app, 'mama', CONFIG.familyCode);

    const response = await app.request('/api/requests', { headers: { Cookie: secondCookie } });

    expect(((await response.json()) as PrintRequestResponse[]).length).toBe(1);
  });

  it('shouldRateLimitRepeatedFailedLogins', async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      await app.request('/api/login', jsonRequest('POST', { name: 'Mama', code: 'wrong-code' }));
    }

    const response = await app.request('/api/login', jsonRequest('POST', { name: 'Mama', code: CONFIG.familyCode }));

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).not.toBeNull();
  });

  it('shouldRateLimitPerForwardedClientIpBehindProxy', async () => {
    const proxiedApp = createTestApp({ ...CONFIG, clientIpHeader: 'x-real-ip' });
    const attackerHeaders = { 'X-Real-IP': '203.0.113.7' };
    for (let attempt = 0; attempt < 10; attempt++) {
      await proxiedApp.request('/api/login', withHeaders(jsonRequest('POST', { name: 'X', code: 'wrong-code' }), attackerHeaders));
    }

    const attacker = await proxiedApp.request(
      '/api/login',
      withHeaders(jsonRequest('POST', { name: 'X', code: CONFIG.familyCode }), attackerHeaders),
    );
    const family = await proxiedApp.request(
      '/api/login',
      withHeaders(jsonRequest('POST', { name: 'Mama', code: CONFIG.familyCode }), { 'X-Real-IP': '198.51.100.20' }),
    );

    expect(attacker.status).toBe(429);
    expect(family.status).toBe(200);
  });

  it('shouldUseLastForwardedForEntryToPreventSpoofing', async () => {
    const proxiedApp = createTestApp({ ...CONFIG, clientIpHeader: 'x-forwarded-for' });
    for (let attempt = 0; attempt < 10; attempt++) {
      // Der Angreifer setzt jedes Mal eine andere gefälschte Adresse an den Anfang
      const headers = { 'X-Forwarded-For': `10.0.0.${attempt}, 203.0.113.7` };
      await proxiedApp.request('/api/login', withHeaders(jsonRequest('POST', { name: 'X', code: 'wrong-code' }), headers));
    }

    const response = await proxiedApp.request(
      '/api/login',
      withHeaders(jsonRequest('POST', { name: 'X', code: CONFIG.familyCode }), { 'X-Forwarded-For': '10.9.9.9, 203.0.113.7' }),
    );

    expect(response.status).toBe(429);
  });

  it('shouldIgnoreForwardedIpHeaderWhenNotConfigured', async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const spoofedHeaders = { 'X-Real-IP': `203.0.113.${attempt}` };
      await app.request('/api/login', withHeaders(jsonRequest('POST', { name: 'X', code: 'wrong-code' }), spoofedHeaders));
    }

    const response = await app.request(
      '/api/login',
      withHeaders(jsonRequest('POST', { name: 'X', code: CONFIG.familyCode }), { 'X-Real-IP': '203.0.113.99' }),
    );

    expect(response.status).toBe(429);
  });

  it('shouldRequireSessionForRequests', async () => {
    const response = await app.request('/api/requests');

    expect(response.status).toBe(401);
  });

  it('shouldCreateRequestWithPreviewData', async () => {
    const cookie = await login(app, 'Mama', CONFIG.familyCode);

    const created = await createRequest(app, cookie);

    expect(created).toMatchObject({
      title: 'Titel 123456',
      imageUrl: 'https://cdn.example.tld/a.jpg',
      requesterName: 'Mama',
      isOwn: true,
      status: 'new',
    });
  });

  it('shouldPreferTitleEnteredByUser', async () => {
    const cookie = await login(app, 'Mama', CONFIG.familyCode);

    const response = await app.request(
      '/api/requests',
      jsonRequest('POST', { url: MODEL_URL, title: 'Handyhalter fürs Auto', quantity: 1 }, cookie),
    );

    expect(((await response.json()) as PrintRequestResponse).title).toBe('Handyhalter fürs Auto');
  });

  it('shouldPreferLoadedTitleOverUrlPlaceholder', async () => {
    const cookie = await login(app, 'Mama', CONFIG.familyCode);

    const response = await app.request(
      '/api/requests',
      jsonRequest('POST', { url: MODEL_URL, title: 'Handyhalter', quantity: 1 }, cookie),
    );

    expect(((await response.json()) as PrintRequestResponse).title).toBe('Titel 123456');
  });

  it('shouldShowFamilyMembersOnlyTheirOwnRequests', async () => {
    const mamaCookie = await login(app, 'Mama', CONFIG.familyCode);
    const papaCookie = await login(app, 'Papa', CONFIG.familyCode);
    await createRequest(app, mamaCookie);

    const response = await app.request('/api/requests', { headers: { Cookie: papaCookie } });

    expect(await response.json()).toEqual([]);
  });

  it('shouldShowAdminAllRequests', async () => {
    const mamaCookie = await login(app, 'Mama', CONFIG.familyCode);
    const adminCookie = await login(app, 'Alex', CONFIG.adminCode);
    await createRequest(app, mamaCookie);

    const response = await app.request('/api/requests', { headers: { Cookie: adminCookie } });
    const requests = (await response.json()) as PrintRequestResponse[];

    expect(requests).toHaveLength(1);
    expect(requests[0]?.isOwn).toBe(false);
  });

  it('shouldForbidStatusChangeForFamilyMembers', async () => {
    const cookie = await login(app, 'Mama', CONFIG.familyCode);
    const created = await createRequest(app, cookie);

    const response = await app.request(`/api/requests/${created.id}`, jsonRequest('PATCH', { status: 'done' }, cookie));

    expect(response.status).toBe(403);
  });

  it('shouldLetAdminChangeStatus', async () => {
    const mamaCookie = await login(app, 'Mama', CONFIG.familyCode);
    const adminCookie = await login(app, 'Alex', CONFIG.adminCode);
    const created = await createRequest(app, mamaCookie);

    const response = await app.request(
      `/api/requests/${created.id}`,
      jsonRequest('PATCH', { status: 'printing' }, adminCookie),
    );

    expect(response.status).toBe(200);
    expect(((await response.json()) as PrintRequestResponse).status).toBe('printing');
  });

  it('shouldRejectUnknownStatus', async () => {
    const mamaCookie = await login(app, 'Mama', CONFIG.familyCode);
    const adminCookie = await login(app, 'Alex', CONFIG.adminCode);
    const created = await createRequest(app, mamaCookie);

    const response = await app.request(
      `/api/requests/${created.id}`,
      jsonRequest('PATCH', { status: 'exploded' }, adminCookie),
    );

    expect(response.status).toBe(400);
  });

  it('shouldLetOwnerWithdrawNewRequest', async () => {
    const cookie = await login(app, 'Mama', CONFIG.familyCode);
    const created = await createRequest(app, cookie);

    const response = await app.request(`/api/requests/${created.id}`, { method: 'DELETE', headers: { Cookie: cookie, ...SAME_ORIGIN } });

    expect(response.status).toBe(204);
  });

  it('shouldHideOtherPeoplesRequestsOnDelete', async () => {
    const mamaCookie = await login(app, 'Mama', CONFIG.familyCode);
    const papaCookie = await login(app, 'Papa', CONFIG.familyCode);
    const created = await createRequest(app, mamaCookie);

    const response = await app.request(`/api/requests/${created.id}`, {
      method: 'DELETE',
      headers: { Cookie: papaCookie, ...SAME_ORIGIN },
    });

    expect(response.status).toBe(404);
  });

  it('shouldRejectWithdrawingAcceptedRequest', async () => {
    const mamaCookie = await login(app, 'Mama', CONFIG.familyCode);
    const adminCookie = await login(app, 'Alex', CONFIG.adminCode);
    const created = await createRequest(app, mamaCookie);
    await app.request(`/api/requests/${created.id}`, jsonRequest('PATCH', { status: 'accepted' }, adminCookie));

    const response = await app.request(`/api/requests/${created.id}`, {
      method: 'DELETE',
      headers: { Cookie: mamaCookie, ...SAME_ORIGIN },
    });

    expect(response.status).toBe(409);
  });

  it('shouldLetAdminCreateFilament', async () => {
    const adminCookie = await login(app, 'Alex', CONFIG.adminCode);

    const response = await app.request('/api/filaments', jsonRequest('POST', SILK_GOLD, adminCookie));

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ name: 'Silk Gold', colorHex: '#D4AF37', isAvailable: true });
  });

  it('shouldForbidFilamentChangesForFamilyMembers', async () => {
    const cookie = await login(app, 'Mama', CONFIG.familyCode);

    const response = await app.request('/api/filaments', jsonRequest('POST', SILK_GOLD, cookie));

    expect(response.status).toBe(403);
  });

  it('shouldShowFamilyOnlyAvailableFilaments', async () => {
    const adminCookie = await login(app, 'Alex', CONFIG.adminCode);
    const familyCookie = await login(app, 'Mama', CONFIG.familyCode);
    await app.request('/api/filaments', jsonRequest('POST', SILK_GOLD, adminCookie));
    await app.request('/api/filaments', jsonRequest('POST', { ...SILK_GOLD, name: 'Leer', isAvailable: false }, adminCookie));

    const familyView = (await (await app.request('/api/filaments', { headers: { Cookie: familyCookie } })).json()) as FilamentResponse[];
    const adminView = (await (await app.request('/api/filaments', { headers: { Cookie: adminCookie } })).json()) as FilamentResponse[];

    expect(familyView.map((filament) => filament.name)).toEqual(['Silk Gold']);
    expect(adminView).toHaveLength(2);
  });

  it('shouldUpdateAndDeleteFilament', async () => {
    const adminCookie = await login(app, 'Alex', CONFIG.adminCode);
    const created = (await (await app.request('/api/filaments', jsonRequest('POST', SILK_GOLD, adminCookie))).json()) as FilamentResponse;

    const updated = await app.request(`/api/filaments/${created.id}`, jsonRequest('PUT', { ...SILK_GOLD, isAvailable: false }, adminCookie));
    const deleted = await app.request(`/api/filaments/${created.id}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie, ...SAME_ORIGIN },
    });
    const deletedAgain = await app.request(`/api/filaments/${created.id}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie, ...SAME_ORIGIN },
    });

    expect(((await updated.json()) as FilamentResponse).isAvailable).toBe(false);
    expect(deleted.status).toBe(204);
    expect(deletedAgain.status).toBe(404);
  });

  it('shouldReportPrinterAsDisabledWithoutConfiguration', async () => {
    const cookie = await login(app, 'Mama', CONFIG.familyCode);

    const response = await app.request('/api/printer', { headers: { Cookie: cookie } });

    expect(await response.json()).toMatchObject({ isEnabled: false, amsTrays: [] });
  });

  it('shouldRestrictStatisticsToAdmins', async () => {
    const familyCookie = await login(app, 'Mama', CONFIG.familyCode);
    const adminCookie = await login(app, 'Alex', CONFIG.adminCode);
    await createRequest(app, familyCookie);

    const familyResponse = await app.request('/api/statistics', { headers: { Cookie: familyCookie } });
    const adminResponse = await app.request('/api/statistics', { headers: { Cookie: adminCookie } });

    expect(familyResponse.status).toBe(403);
    expect(await adminResponse.json()).toMatchObject({ totalRequests: 1, openRequests: 1 });
  });

  it('shouldRecordCompletionTimeOnlyOnce', async () => {
    const familyCookie = await login(app, 'Mama', CONFIG.familyCode);
    const adminCookie = await login(app, 'Alex', CONFIG.adminCode);
    const created = await createRequest(app, familyCookie);
    await app.request(`/api/requests/${created.id}`, jsonRequest('PATCH', { status: 'done' }, adminCookie));
    await app.request(`/api/requests/${created.id}`, jsonRequest('PATCH', { status: 'collected' }, adminCookie));

    const statistics = await (await app.request('/api/statistics', { headers: { Cookie: adminCookie } })).json();

    expect(statistics).toMatchObject({ printedPieces: 1, averageWaitHours: 0 });
  });

  it('shouldSearchCatalogAsAdminOnly', async () => {
    const adminCookie = await login(app, 'Alex', CONFIG.adminCode);
    const familyCookie = await login(app, 'Mama', CONFIG.familyCode);

    const admin = await app.request('/api/filament-catalog?query=grün', { headers: { Cookie: adminCookie } });
    const family = await app.request('/api/filament-catalog?query=grün', { headers: { Cookie: familyCookie } });
    const byCode = await app.request('/api/filament-catalog/11101', { headers: { Cookie: adminCookie } });
    const unknown = await app.request('/api/filament-catalog/00000', { headers: { Cookie: adminCookie } });

    expect(await admin.json()).toEqual([
      { code: '10501', name: 'Bambusgrün', productLine: 'PLA Basic', colorHex: '#00AE42', colors: ['#00AE42'] },
    ]);
    expect(family.status).toBe(403);
    expect(await byCode.json()).toMatchObject({ name: 'Kohlschwarz' });
    expect(unknown.status).toBe(404);
  });

  it('shouldSortUrgentFirstThenManualOrder', async () => {
    const familyCookie = await login(app, 'Mama', CONFIG.familyCode);
    const adminCookie = await login(app, 'Alex', CONFIG.adminCode);
    const first = await createRequest(app, familyCookie);
    const second = await createRequest(app, familyCookie);
    const third = await createRequest(app, familyCookie);

    await app.request('/api/requests/order', jsonRequest('PUT', { ids: [third.id, first.id, second.id] }, adminCookie));
    await app.request(`/api/requests/${second.id}`, jsonRequest('PATCH', { isUrgent: true }, adminCookie));
    const requests = (await (await app.request('/api/requests', { headers: { Cookie: adminCookie } })).json()) as PrintRequestResponse[];

    expect(requests.map((request) => request.id)).toEqual([second.id, third.id, first.id]);
    expect(requests[0]?.isUrgent).toBe(true);
  });

  it.each([
    [{}],
    [{ isUrgent: 'ja' }],
    [{ status: 'kaputt' }],
  ])('shouldRejectInvalidUpdate %j', async (body) => {
    const familyCookie = await login(app, 'Mama', CONFIG.familyCode);
    const adminCookie = await login(app, 'Alex', CONFIG.adminCode);
    const created = await createRequest(app, familyCookie);

    const response = await app.request(`/api/requests/${created.id}`, jsonRequest('PATCH', body, adminCookie));

    expect(response.status).toBe(400);
  });

  it.each([
    [{ ids: 'x' }],
    [{ ids: [1, 1] }],
    [{ ids: [1, -2] }],
    [{ ids: [1.5] }],
  ])('shouldRejectInvalidOrder %j', async (body) => {
    const adminCookie = await login(app, 'Alex', CONFIG.adminCode);

    const response = await app.request('/api/requests/order', jsonRequest('PUT', body, adminCookie));

    expect(response.status).toBe(400);
  });

  it('shouldForbidReorderingForFamilyMembers', async () => {
    const familyCookie = await login(app, 'Mama', CONFIG.familyCode);

    const response = await app.request('/api/requests/order', jsonRequest('PUT', { ids: [1] }, familyCookie));

    expect(response.status).toBe(403);
  });

  it('shouldHideSavedRequestsFromAdminAndStatistics', async () => {
    const familyCookie = await login(app, 'Mama', CONFIG.familyCode);
    const adminCookie = await login(app, 'Alex', CONFIG.adminCode);
    await app.request('/api/requests', jsonRequest('POST', { url: MODEL_URL, quantity: 1, isSaved: true }, familyCookie));

    const own = (await (await app.request('/api/requests', { headers: { Cookie: familyCookie } })).json()) as PrintRequestResponse[];
    const admin = (await (await app.request('/api/requests', { headers: { Cookie: adminCookie } })).json()) as PrintRequestResponse[];
    const statistics = await (await app.request('/api/statistics', { headers: { Cookie: adminCookie } })).json();

    expect(own.map((request) => request.status)).toEqual(['saved']);
    expect(admin).toEqual([]);
    expect(statistics).toMatchObject({ totalRequests: 0 });
  });

  it('shouldSubmitSavedRequestOnlyOnceAndOnlyByOwner', async () => {
    const mamaCookie = await login(app, 'Mama', CONFIG.familyCode);
    const papaCookie = await login(app, 'Papa', CONFIG.familyCode);
    const saved = (await (await app.request(
      '/api/requests',
      jsonRequest('POST', { url: MODEL_URL, quantity: 1, isSaved: true }, mamaCookie),
    )).json()) as PrintRequestResponse;
    const submitRequest = (cookie: string) => app.request(`/api/requests/${saved.id}/submit`, {
      method: 'POST',
      headers: { Cookie: cookie, ...SAME_ORIGIN },
    });

    const byOther = await submitRequest(papaCookie);
    const byOwner = await submitRequest(mamaCookie);
    const again = await submitRequest(mamaCookie);

    expect(byOther.status).toBe(404);
    expect(((await byOwner.json()) as PrintRequestResponse).status).toBe('new');
    expect(again.status).toBe(409);
  });

  it('shouldLetOwnerDeleteSavedRequest', async () => {
    const cookie = await login(app, 'Mama', CONFIG.familyCode);
    const saved = (await (await app.request(
      '/api/requests',
      jsonRequest('POST', { url: MODEL_URL, quantity: 1, isSaved: true }, cookie),
    )).json()) as PrintRequestResponse;

    const response = await app.request(`/api/requests/${saved.id}`, { method: 'DELETE', headers: { Cookie: cookie, ...SAME_ORIGIN } });

    expect(response.status).toBe(204);
  });

  it('shouldNotLetAdminMoveRequestToWishlist', async () => {
    const familyCookie = await login(app, 'Mama', CONFIG.familyCode);
    const adminCookie = await login(app, 'Alex', CONFIG.adminCode);
    const created = await createRequest(app, familyCookie);

    const response = await app.request(`/api/requests/${created.id}`, jsonRequest('PATCH', { status: 'saved' }, adminCookie));

    expect(response.status).toBe(400);
  });

  it('shouldRejectCrossSiteFormPost', async () => {
    const response = await app.request('/api/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Sec-Fetch-Site': 'cross-site' },
      body: '',
    });

    expect(response.status).toBe(403);
  });

  it('shouldInvalidateSessionOnLogout', async () => {
    const cookie = await login(app, 'Mama', CONFIG.familyCode);
    await app.request('/api/logout', { method: 'POST', headers: { Cookie: cookie, ...SAME_ORIGIN } });

    const response = await app.request('/api/me', { headers: { Cookie: cookie } });

    expect(response.status).toBe(401);
  });
});

describe('Push', () => {
  const DEVICE_TOKEN = 'ExponentPushToken[abcDEF123_-xyz]';
  let app: App;
  let notifiedRequests: PrintRequest[];

  beforeEach(() => {
    notifiedRequests = [];
    app = createTestApp(CONFIG, notifiedRequests);
  });

  it('shouldRegisterPushTokenOfSignedInDevice', async () => {
    const cookie = await login(app, 'Papa', CONFIG.adminCode);

    const response = await app.request('/api/push-tokens', jsonRequest('POST', { token: DEVICE_TOKEN }, cookie));

    expect(response.status).toBe(204);
  });

  it.each([[''], ['abc'], ['ExponentPushToken[]'], ['ExponentPushToken[a b]'], [42]])('shouldRejectInvalidPushToken %j', async (token) => {
    const cookie = await login(app, 'Papa', CONFIG.adminCode);

    const response = await app.request('/api/push-tokens', jsonRequest('POST', { token }, cookie));

    expect(response.status).toBe(400);
  });

  it('shouldRequireSessionToRegisterPushToken', async () => {
    const response = await app.request('/api/push-tokens', jsonRequest('POST', { token: DEVICE_TOKEN }));

    expect(response.status).toBe(401);
  });

  it('shouldUnregisterPushToken', async () => {
    const cookie = await login(app, 'Papa', CONFIG.adminCode);
    await app.request('/api/push-tokens', jsonRequest('POST', { token: DEVICE_TOKEN }, cookie));

    const response = await app.request('/api/push-tokens', jsonRequest('DELETE', { token: DEVICE_TOKEN }, cookie));

    expect(response.status).toBe(204);
  });

  it('shouldNotifyAboutNewRequest', async () => {
    const cookie = await login(app, 'Mama', CONFIG.familyCode);

    const created = await createRequest(app, cookie);

    expect(notifiedRequests.map((request) => request.id)).toEqual([created.id]);
  });

  it('shouldNotNotifyAboutSavedModel', async () => {
    const cookie = await login(app, 'Mama', CONFIG.familyCode);

    await app.request('/api/requests', jsonRequest('POST', { url: MODEL_URL, quantity: 1, isSaved: true }, cookie));

    expect(notifiedRequests).toEqual([]);
  });

  it('shouldNotifyWhenSavedModelIsSubmitted', async () => {
    const cookie = await login(app, 'Mama', CONFIG.familyCode);
    const saved = (await (await app.request(
      '/api/requests',
      jsonRequest('POST', { url: MODEL_URL, quantity: 1, isSaved: true }, cookie),
    )).json()) as PrintRequestResponse;

    await app.request(`/api/requests/${saved.id}/submit`, jsonRequest('POST', {}, cookie));

    expect(notifiedRequests.map((request) => request.status)).toEqual(['new']);
  });
});
