import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../AppEnv';
import type { SessionRepository } from './Repository/SessionRepository';

export const SESSION_COOKIE_NAME = 'druckwunsch_session';

export function requireSession(sessions: SessionRepository, now: () => Date) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE_NAME);
    if (token === undefined) return c.json({ error: 'Nicht angemeldet' }, 401);

    const session = sessions.loadSession(token, now());
    if (session === null) return c.json({ error: 'Nicht angemeldet' }, 401);

    c.set('session', session);
    await next();
  });
}

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get('session').role !== 'admin') return c.json({ error: 'Nur für Admins' }, 403);
  await next();
});
