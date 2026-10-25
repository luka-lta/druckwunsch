/** Standard-Port des HTTP-Servers */
const DEFAULT_PORT = 3000;

/** Mindestlänge der Zugangscodes, damit sie nicht trivial erraten werden können */
const MIN_CODE_LENGTH = 6;

// Gültiger HTTP-Header-Name, z.B. "x-real-ip" oder "cf-connecting-ip"
const HEADER_NAME_PATTERN = /^[a-z0-9-]+$/;

export interface Config {
  readonly port: number;
  readonly familyCode: string;
  readonly adminCode: string;
  readonly dataDir: string;
  readonly isCookieSecure: boolean;
  /**
   * Header, in dem ein vorgeschalteter Reverse-Proxy die echte Client-IP mitschickt.
   * null: Die Verbindungsadresse zählt. Nur setzen, wenn die App ausschließlich über den Proxy erreichbar ist.
   */
  readonly clientIpHeader: string | null;
  /** Optionales Zugriffstoken für den Expo-Push-Dienst, falls im Expo-Projekt "Enhanced Security" aktiv ist */
  readonly expoAccessToken: string | null;
}

export class ConfigError extends Error {
  private constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }

  static missing(key: string): ConfigError {
    return new ConfigError(`Missing environment variable ${key}`);
  }

  static invalid(key: string, reason: string): ConfigError {
    return new ConfigError(`Invalid environment variable ${key}: ${reason}`);
  }
}

export function parseConfig(env: NodeJS.ProcessEnv): Config {
  const familyCode = parseCode(env, 'FAMILY_CODE');
  const adminCode = parseCode(env, 'ADMIN_CODE');
  if (familyCode === adminCode) throw ConfigError.invalid('ADMIN_CODE', 'Must differ from FAMILY_CODE');

  return {
    port: parsePort(env.PORT),
    familyCode,
    adminCode,
    dataDir: env.DATA_DIR?.trim() || './data',
    isCookieSecure: env.COOKIE_SECURE === 'true',
    clientIpHeader: parseHeaderName(env, 'CLIENT_IP_HEADER'),
    expoAccessToken: env.EXPO_ACCESS_TOKEN?.trim() || null,
  };
}

function parseHeaderName(env: NodeJS.ProcessEnv, key: string): string | null {
  const value = env[key]?.trim().toLowerCase();
  if (value === undefined || value === '') return null;
  if (!HEADER_NAME_PATTERN.test(value)) throw ConfigError.invalid(key, 'Not a valid header name');
  return value;
}

function parseCode(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (value === undefined || value === '') throw ConfigError.missing(key);
  if (value.length < MIN_CODE_LENGTH) throw ConfigError.invalid(key, `Must have at least ${MIN_CODE_LENGTH} characters`);
  return value;
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) throw ConfigError.invalid('PORT', 'Not a valid port');
  return port;
}
