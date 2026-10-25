/** Push-Token eines Geräts für den Expo-Push-Dienst, z.B. "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" */
export type ExpoPushToken = string & { readonly __brand: 'ExpoPushToken' };

/** Höchstlänge eines Push-Tokens in Zeichen; echte Tokens sind deutlich kürzer */
const MAX_TOKEN_LENGTH = 200;

const TOKEN_PATTERN = /^(?:ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;

export function parseExpoPushToken(input: unknown): ExpoPushToken | null {
  if (typeof input !== 'string') return null;
  const token = input.trim();
  if (token.length > MAX_TOKEN_LENGTH || !TOKEN_PATTERN.test(token)) return null;
  return token as ExpoPushToken;
}
