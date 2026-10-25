import type { DatabaseSync } from 'node:sqlite';
import type { Role } from '../../../shared/api';
import type { UserId } from '../../Auth/Session';
import type { ExpoPushToken } from '../PushToken';

export class PushTokenRepository {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  /** Merkt sich das Gerät; meldet sich auf dem Gerät jemand anderes an, gehört es danach dieser Person */
  saveToken(token: ExpoPushToken, userId: UserId, role: Role, now: Date): void {
    this.database
      .prepare(
        `INSERT INTO push_tokens (token, user_id, role, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT (token) DO UPDATE SET user_id = excluded.user_id, role = excluded.role, updated_at = excluded.updated_at`,
      )
      .run(token, userId, role, now.toISOString());
  }

  /** Entfernt das Gerät, aber nur, wenn es der angemeldeten Person gehört */
  deleteTokenOfUser(token: ExpoPushToken, userId: UserId): void {
    this.database.prepare('DELETE FROM push_tokens WHERE token = ? AND user_id = ?').run(token, userId);
  }

  /** Entfernt Geräte, die laut Expo keine Mitteilungen mehr empfangen können */
  deleteTokens(tokens: readonly ExpoPushToken[]): void {
    const statement = this.database.prepare('DELETE FROM push_tokens WHERE token = ?');
    for (const token of tokens) statement.run(token);
  }

  /** Geräte aller Admins, optional ohne die Geräte einer Person (z.B. der, die gerade gewünscht hat) */
  loadAdminTokens(excludedUserId: UserId | null): ExpoPushToken[] {
    const rows = this.database
      .prepare("SELECT token FROM push_tokens WHERE role = 'admin' AND user_id IS NOT ? ORDER BY updated_at DESC")
      .all(excludedUserId);
    return rows.map((row) => String(row.token) as ExpoPushToken);
  }
}
