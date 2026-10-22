import { createHash, timingSafeEqual } from 'node:crypto';
import type { Role } from '../../shared/api';
import type { Config } from '../Config';

/** Ermittelt die Rolle zum eingegebenen Code, oder null wenn der Code falsch ist */
export function resolveRoleForCode(code: string, config: Config): Role | null {
  if (isCodeEqual(code, config.adminCode)) return 'admin';
  if (isCodeEqual(code, config.familyCode)) return 'family';
  return null;
}

// Vergleich über Hashes gleicher Länge in konstanter Zeit, damit die Antwortzeit nichts über den Code verrät.
function isCodeEqual(input: string, expected: string): boolean {
  const inputDigest = createHash('sha256').update(input.trim()).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();
  return timingSafeEqual(inputDigest, expectedDigest);
}
