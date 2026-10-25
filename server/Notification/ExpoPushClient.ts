import type { ExpoPushToken } from './PushToken';

/** Endpunkt des Expo-Push-Dienstes, der an Apple (APNs) und Google (FCM) weiterleitet */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Höchstzahl an Nachrichten pro Anfrage an Expo */
const MAX_MESSAGES_PER_REQUEST = 100;

/** Maximale Wartezeit auf Expo: 10 Sekunden */
const REQUEST_TIMEOUT_MS = 10_000;

export interface PushMessage {
  readonly to: ExpoPushToken;
  readonly title: string;
  readonly body: string;
  /** Wird an die App übergeben, z.B. um beim Antippen den passenden Wunsch zu öffnen */
  readonly data: Record<string, string | number>;
}

export type PushSender = (messages: readonly PushMessage[]) => Promise<PushResult>;

export interface PushResult {
  /** Geräte, die laut Expo keine Mitteilungen mehr empfangen (App gelöscht, Token ungültig) */
  readonly unregisteredTokens: ExpoPushToken[];
}

type Fetch = typeof fetch;

/**
 * Schickt Mitteilungen über den Expo-Push-Dienst. Ohne Zugriffstoken funktioniert das, solange im
 * Expo-Projekt "Enhanced Security for Push Notifications" ausgeschaltet ist.
 */
export function createExpoPushSender(accessToken: string | null, fetchImplementation: Fetch = fetch): PushSender {
  return async (messages) => {
    const unregisteredTokens: ExpoPushToken[] = [];
    for (let start = 0; start < messages.length; start += MAX_MESSAGES_PER_REQUEST) {
      const chunk = messages.slice(start, start + MAX_MESSAGES_PER_REQUEST);
      const tickets = await sendChunk(chunk, accessToken, fetchImplementation);
      tickets.forEach((ticket, index) => {
        const message = chunk[index];
        if (message !== undefined && isUnregistered(ticket)) unregisteredTokens.push(message.to);
      });
    }
    return { unregisteredTokens };
  };
}

async function sendChunk(chunk: readonly PushMessage[], accessToken: string | null, fetchImplementation: Fetch): Promise<unknown[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (accessToken !== null) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetchImplementation(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(chunk.map((message) => ({ ...message, sound: 'default', priority: 'high' }))),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Expo push request failed: HTTP ${response.status}`);

  const body: unknown = await response.json();
  const data = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).data : undefined;
  return Array.isArray(data) ? data : [];
}

function isUnregistered(ticket: unknown): boolean {
  if (typeof ticket !== 'object' || ticket === null) return false;
  const details = (ticket as Record<string, unknown>).details;
  if (typeof details !== 'object' || details === null) return false;
  return (details as Record<string, unknown>).error === 'DeviceNotRegistered';
}
