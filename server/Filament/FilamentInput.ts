import { parseColorHex, type ColorHex } from '../../shared/ColorHex';
import type { ParseResult } from '../PrintRequest/PrintRequestInput';

/** Maximale Länge des Filamentnamens in Zeichen */
export const MAX_FILAMENT_NAME_LENGTH = 40;

/** Maximale Länge der Materialangabe in Zeichen */
export const MAX_MATERIAL_LENGTH = 20;

/** Geprüfte Eingabe für eine Spule in der Filament-Bibliothek */
export interface FilamentInput {
  readonly name: string;
  readonly material: string;
  readonly colorHex: ColorHex;
  readonly isAvailable: boolean;
}

export function parseFilamentInput(body: unknown): ParseResult<FilamentInput> {
  if (typeof body !== 'object' || body === null) return fail('Ungültige Anfrage');
  const fields = body as Record<string, unknown>;

  const name = typeof fields.name === 'string' ? fields.name.trim().replace(/\s+/g, ' ') : '';
  if (name === '') return fail('Bitte einen Namen angeben');
  if ([...name].length > MAX_FILAMENT_NAME_LENGTH) {
    return fail(`Der Name darf höchstens ${MAX_FILAMENT_NAME_LENGTH} Zeichen haben`);
  }

  const material = typeof fields.material === 'string' ? fields.material.trim() : '';
  if (material === '') return fail('Bitte ein Material angeben, z.B. PLA');
  if ([...material].length > MAX_MATERIAL_LENGTH) {
    return fail(`Das Material darf höchstens ${MAX_MATERIAL_LENGTH} Zeichen haben`);
  }

  const colorHex = parseColorHex(fields.colorHex);
  if (colorHex === null) return fail('Bitte eine gültige Farbe angeben');

  if (typeof fields.isAvailable !== 'boolean') return fail('Ungültige Angabe zur Verfügbarkeit');

  return { isOk: true, value: { name, material, colorHex, isAvailable: fields.isAvailable } };
}

function fail(error: string): ParseResult<never> {
  return { isOk: false, error };
}
