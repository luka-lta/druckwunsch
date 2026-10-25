import { Hono } from 'hono';
import type { AppDependencies } from '../AppDependencies';
import type { AppEnv } from '../AppEnv';
import { requireSession } from '../Auth/sessionMiddleware';
import { parseExpoPushToken } from './PushToken';

export function createPushRoutes(deps: AppDependencies): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  const withSession = requireSession(deps.sessions, deps.now);

  // Die App meldet ihr Gerät nach dem Anmelden an, damit es Mitteilungen bekommt.
  // Usage: curl -X POST /api/push-tokens --cookie 'druckwunsch_session=<token>' --header 'Content-Type: application/json'
  //     --data '{"token":"ExponentPushToken[<geraete-token>]"}'
  routes.post('/push-tokens', withSession, async (c) => {
    const session = c.get('session');
    const token = parseExpoPushToken(((await c.req.json().catch(() => null)) as Record<string, unknown> | null)?.token);
    if (token === null) return c.json({ error: 'Ungültiges Push-Token' }, 400);

    deps.pushTokens.saveToken(token, session.userId, session.role, deps.now());
    return c.body(null, 204);
  });

  // Beim Abmelden meldet die App das Gerät wieder ab.
  // Usage: curl -X DELETE /api/push-tokens --cookie 'druckwunsch_session=<token>' --header 'Content-Type: application/json'
  //     --data '{"token":"ExponentPushToken[<geraete-token>]"}'
  routes.delete('/push-tokens', withSession, async (c) => {
    const session = c.get('session');
    const token = parseExpoPushToken(((await c.req.json().catch(() => null)) as Record<string, unknown> | null)?.token);
    if (token === null) return c.json({ error: 'Ungültiges Push-Token' }, 400);

    deps.pushTokens.deleteTokenOfUser(token, session.userId);
    return c.body(null, 204);
  });

  return routes;
}
