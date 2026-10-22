import type { Session } from './Auth/Session';

/** Hono-Umgebung: Variablen, die Middlewares im Request-Kontext ablegen */
export interface AppEnv {
  Variables: {
    session: Session;
  };
}
