import type { DatabaseSync } from 'node:sqlite';
import { toUserNameKey, type UserId, type UserName } from '../Session';

export interface User {
  readonly id: UserId;
  readonly name: string;
}

export class UserRepository {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  /** Lädt die Person mit diesem Namen oder legt sie beim ersten Login an */
  loadOrCreateUser(name: UserName, now: Date): User {
    const nameKey = toUserNameKey(name);
    this.database
      .prepare('INSERT INTO users (name, name_key, created_at) VALUES (?, ?, ?) ON CONFLICT (name_key) DO NOTHING')
      .run(name, nameKey, now.toISOString());

    const row = this.database.prepare('SELECT id, name FROM users WHERE name_key = ?').get(nameKey);
    if (row === undefined) throw new Error('Failed to load user after insert');
    return { id: Number(row.id) as UserId, name: String(row.name) };
  }
}
