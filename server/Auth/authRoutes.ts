import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { getConnInfo } from '@hono/node-server/conninfo';
import type { MeResponse } from '../../shared/api';
import type { AppEnv } from '../AppEnv';
import type { AppDependencies } from '../AppDependencies';
import { resolveRoleForCode } from './AccessCode';
import { SESSION_LIFETIME_MS } from './Repository/SessionRepository';
import { MAX_USER_NAME_LENGTH, parseUserName } from './Session';
import { requireSession, SESSION_COOKIE_NAME } from './sessionMiddleware';

export function createAuthRoutes(deps: AppDependencies): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  // Usage: curl -X POST /api/login --header 'Content-Type: application/json' --data '{"name":"Mama","code":"<code>"}'
  routes.post('/login', async (c) => {
    const clientKey = getClientKey(c, deps.config.clientIpHeader);
    const retryAfterSeconds = deps.loginRateLimiter.getRetryAfterSeconds(clientKey, deps.now().getTime());
    if (retryAfterSeconds > 0) {
      c.header('Retry-After', String(retryAfterSeconds));
      return c.json({ error: 'Zu viele Fehlversuche, bitte später erneut versuchen' }, 429);
    }

    const body: unknown = await c.req.json().catch(() => null);
    if (typeof body !== 'object' || body === null) return c.json({ error: 'Ungültige Anfrage' }, 400);

    const name = parseUserName((body as Record<string, unknown>).name);
    if (name === null) {
      return c.json({ error: `Bitte einen Namen mit höchstens ${MAX_USER_NAME_LENGTH} Zeichen angeben` }, 400);
    }

    const code = (body as Record<string, unknown>).code;
    const role = typeof code === 'string' ? resolveRoleForCode(code, deps.config) : null;
    if (role === null) {
      deps.loginRateLimiter.recordFailure(clientKey, deps.now().getTime());
      return c.json({ error: 'Falscher Code' }, 401);
    }

    deps.loginRateLimiter.reset(clientKey);
    const user = deps.users.loadOrCreateUser(name, deps.now());
    const token = deps.sessions.createSession(user.id, role, deps.now());
    setCookie(c, SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: deps.config.isCookieSecure,
      sameSite: 'Lax',
      path: '/',
      maxAge: SESSION_LIFETIME_MS / 1000,
    });

    const response: MeResponse = { name: user.name, role };
    return c.json(response);
  });

  // Usage: curl -X POST /api/logout --cookie 'druckwunsch_session=<token>'
  routes.post('/logout', (c) => {
    const token = getCookie(c, SESSION_COOKIE_NAME);
    if (token !== undefined) deps.sessions.deleteSession(token);
    deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });
    return c.body(null, 204);
  });

  // Usage: curl /api/me --cookie 'druckwunsch_session=<token>'
  routes.get('/me', requireSession(deps.sessions, deps.now), (c) => {
    const session = c.get('session');
    const response: MeResponse = { name: session.userName, role: session.role };
    return c.json(response);
  });

  return routes;
}

/**
 * Ermittelt den Client für die Login-Sperre. Hinter einem Reverse-Proxy (z.B. Nginx Proxy Manager)
 * kämen sonst alle Anfragen von der Proxy-Adresse und Fehlversuche einer Person würden alle sperren.
 */
function getClientKey(c: Context<AppEnv>, clientIpHeader: string | null): string {
  const forwardedIp = clientIpHeader === null ? null : parseForwardedIp(c.req.header(clientIpHeader));
  if (forwardedIp !== null) return forwardedIp;

  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

// X-Forwarded-For ist eine Kette "client, proxy1, …". Den Anfang kann der Client selbst fälschen;
// verlässlich ist nur der letzte Eintrag, den der eigene Proxy angehängt hat. X-Real-IP enthält nur eine Adresse.
function parseForwardedIp(value: string | undefined): string | null {
  const lastEntry = value?.split(',').pop()?.trim() ?? '';
  return lastEntry === '' ? null : lastEntry;
}
