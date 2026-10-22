import type { Role } from '../../shared/api';

export type UserId = number & { readonly __brand: 'UserId' };

/** Bereinigter Anzeigename einer Person, z.B. "Mama" */
export type UserName = string & { readonly __brand: 'UserName' };

/** Maximale Länge eines Anzeigenamens in Zeichen */
export const MAX_USER_NAME_LENGTH = 30;

export interface Session {
  readonly userId: UserId;
  readonly userName: string;
  readonly role: Role;
}

export function parseUserName(input: unknown): UserName | null {
  if (typeof input !== 'string') return null;
  const name = input.trim().replace(/\s+/g, ' ');
  if (name === '') return null;
  if ([...name].length > MAX_USER_NAME_LENGTH) return null;
  return name as UserName;
}

/** Schlüssel für den Namensvergleich, damit "mama" und "Mama" dieselbe Person sind */
export function toUserNameKey(name: UserName): string {
  return name.toLocaleLowerCase('de-DE');
}
