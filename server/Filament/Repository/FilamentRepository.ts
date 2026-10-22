import type { DatabaseSync } from 'node:sqlite';
import { parseColorHex, type ColorHex } from '../../../shared/ColorHex';
import type { FilamentInput } from '../FilamentInput';

export type FilamentId = number & { readonly __brand: 'FilamentId' };

export interface Filament {
  readonly id: FilamentId;
  readonly name: string;
  readonly material: string;
  readonly colorHex: ColorHex;
  readonly isAvailable: boolean;
}

const SELECT_FIELDS = 'SELECT id, name, material, color_hex, is_available FROM filaments';

export class FilamentRepository {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  loadAllFilaments(): Filament[] {
    const rows = this.database.prepare(`${SELECT_FIELDS} ORDER BY material COLLATE NOCASE, name COLLATE NOCASE`).all();
    return rows.map(toFilament);
  }

  loadFilament(id: FilamentId): Filament | null {
    const row = this.database.prepare(`${SELECT_FIELDS} WHERE id = ?`).get(id);
    return row === undefined ? null : toFilament(row);
  }

  createFilament(input: FilamentInput, now: Date): FilamentId {
    const timestamp = now.toISOString();
    const result = this.database
      .prepare(
        `INSERT INTO filaments (name, material, color_hex, is_available, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(input.name, input.material, input.colorHex, input.isAvailable ? 1 : 0, timestamp, timestamp);
    return Number(result.lastInsertRowid) as FilamentId;
  }

  updateFilament(id: FilamentId, input: FilamentInput, now: Date): void {
    this.database
      .prepare(
        `UPDATE filaments SET name = ?, material = ?, color_hex = ?, is_available = ?, updated_at = ?
        WHERE id = ?`,
      )
      .run(input.name, input.material, input.colorHex, input.isAvailable ? 1 : 0, now.toISOString(), id);
  }

  deleteFilament(id: FilamentId): void {
    this.database.prepare('DELETE FROM filaments WHERE id = ?').run(id);
  }
}

function toFilament(row: Record<string, unknown>): Filament {
  const colorHex = parseColorHex(row.color_hex);
  if (colorHex === null) throw new Error(`Invalid filament color in database: ${String(row.color_hex)}`);

  return {
    id: Number(row.id) as FilamentId,
    name: String(row.name),
    material: String(row.material),
    colorHex,
    isAvailable: Number(row.is_available) === 1,
  };
}
