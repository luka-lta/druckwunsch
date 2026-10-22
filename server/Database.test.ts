import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { openDatabase } from './Database';

describe('openDatabase', () => {
  it('shouldMigrateOldDatabaseAndBackfillCompletionTime', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'druckwunsch-')), 'migration.sqlite');
    const legacy = new DatabaseSync(path);
    legacy.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
      CREATE TABLE print_requests (
        id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, model_id TEXT NOT NULL, url TEXT NOT NULL, title TEXT NOT NULL,
        image_url TEXT, color TEXT NOT NULL, quantity INTEGER NOT NULL, note TEXT NOT NULL, status TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO users VALUES (1, 'Oma', 'oma', '2026-10-01T00:00:00Z');
      INSERT INTO print_requests VALUES (1, 1, '1', 'u', 't', NULL, '', 1, '', 'collected', '2026-10-01T00:00:00Z', '2026-10-03T00:00:00Z');
      INSERT INTO print_requests VALUES (2, 1, '2', 'u', 't', NULL, '', 1, '', 'printing', '2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z');
    `);
    legacy.close();

    const database = openDatabase(path);
    const rows = database.prepare('SELECT id, completed_at FROM print_requests ORDER BY id').all();
    database.close();

    expect(rows).toEqual([
      { id: 1, completed_at: '2026-10-03T00:00:00Z' },
      { id: 2, completed_at: null },
    ]);
  });

  it('shouldBeIdempotentWhenOpenedTwice', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'druckwunsch-')), 'idempotent.sqlite');
    openDatabase(path).close();

    expect(() => openDatabase(path).close()).not.toThrow();
  });
});
