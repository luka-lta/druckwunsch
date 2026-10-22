import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'family')),
    expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS print_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    model_id TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    image_url TEXT,
    color TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    note TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS print_requests_user_id ON print_requests (user_id);

CREATE TABLE IF NOT EXISTS print_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_key TEXT NOT NULL,
    name TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    result TEXT NOT NULL CHECK (result IN ('running', 'finished', 'failed')),
    start_snapshot TEXT NOT NULL,
    filament_grams REAL
);

CREATE INDEX IF NOT EXISTS print_jobs_job_key ON print_jobs (job_key);

CREATE TABLE IF NOT EXISTS filaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    material TEXT NOT NULL,
    color_hex TEXT NOT NULL,
    is_available INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
`;

/**
 * Öffnet die SQLite-Datenbank und legt fehlende Tabellen an.
 * Mit ":memory:" entsteht eine flüchtige Datenbank (z.B. für Tests).
 */
export function openDatabase(path: string): DatabaseSync {
  const database = new DatabaseSync(path);
  database.exec('PRAGMA journal_mode = WAL');
  database.exec('PRAGMA foreign_keys = ON');
  database.exec(SCHEMA);
  migrate(database);
  return database;
}

/** Ergänzt Spalten, die nach dem ersten Release dazugekommen sind */
function migrate(database: DatabaseSync): void {
  if (!hasColumn(database, 'print_requests', 'completed_at')) {
    database.exec('ALTER TABLE print_requests ADD COLUMN completed_at TEXT');
    // Für bereits fertige Wünsche ist der letzte Statuswechsel die beste verfügbare Schätzung
    database.exec("UPDATE print_requests SET completed_at = updated_at WHERE status IN ('done', 'collected')");
  }
  if (!hasColumn(database, 'print_requests', 'is_urgent')) {
    database.exec('ALTER TABLE print_requests ADD COLUMN is_urgent INTEGER NOT NULL DEFAULT 0');
    database.exec('ALTER TABLE print_requests ADD COLUMN position INTEGER');
  }
  if (!hasColumn(database, 'print_requests', 'print_job_id')) {
    database.exec('ALTER TABLE print_requests ADD COLUMN print_job_id INTEGER REFERENCES print_jobs (id) ON DELETE SET NULL');
  }
}

function hasColumn(database: DatabaseSync, table: string, column: string): boolean {
  const columns = database.prepare(`SELECT name FROM pragma_table_info(?)`).all(table);
  return columns.some((row) => row.name === column);
}
