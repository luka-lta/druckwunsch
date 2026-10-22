import { createHash, randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Role } from '../../../shared/api';
import type { Session, UserId } from '../Session';

/** Länge des zufälligen Session-Tokens in Bytes */
const TOKEN_BYTES = 32;

/** Gültigkeitsdauer einer Session: 90 Tage in Millisekunden */
export const SESSION_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

export class SessionRepository {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  /** Legt eine Session an und gibt das Klartext-Token für das Cookie zurück */
  createSession(userId: UserId, role: Role, now: Date): string {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS);
    this.database
      .prepare('INSERT INTO sessions (token_hash, user_id, role, expires_at) VALUES (?, ?, ?, ?)')
      .run(hashToken(token), userId, role, expiresAt.toISOString());
    return token;
  }

  loadSession(token: string, now: Date): Session | null {
    const row = this.database
      .prepare(
        `SELECT s.user_id, s.role, u.name
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ?`,
      )
      .get(hashToken(token), now.toISOString());
    if (row === undefined) return null;

    return {
      userId: Number(row.user_id) as UserId,
      userName: String(row.name),
      role: row.role === 'admin' ? 'admin' : 'family',
    };
  }

  deleteSession(token: string): void {
    this.database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  }

  deleteExpiredSessions(now: Date): void {
    this.database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now.toISOString());
  }
}

// In der Datenbank liegt nur der Hash, damit ein Datenbank-Leak keine gültigen Sessions preisgibt.
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
