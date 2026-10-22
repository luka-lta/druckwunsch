/** Erlaubte Fehlversuche pro Client innerhalb eines Zeitfensters */
const MAX_FAILED_ATTEMPTS = 10;

/** Länge des Zeitfensters: 15 Minuten in Millisekunden */
const WINDOW_MS = 15 * 60 * 1000;

interface AttemptWindow {
  failedAttempts: number;
  startedAt: number;
}

/** Begrenzt fehlgeschlagene Logins pro Client, damit die Codes nicht durchprobiert werden können */
export class LoginRateLimiter {
  private readonly windows = new Map<string, AttemptWindow>();

  /** Sekunden bis zum nächsten erlaubten Versuch, oder 0 wenn der Client nicht gesperrt ist */
  getRetryAfterSeconds(clientKey: string, now: number): number {
    const window = this.loadActiveWindow(clientKey, now);
    if (window === null) return 0;
    if (window.failedAttempts < MAX_FAILED_ATTEMPTS) return 0;
    return Math.ceil((window.startedAt + WINDOW_MS - now) / 1000);
  }

  recordFailure(clientKey: string, now: number): void {
    const window = this.loadActiveWindow(clientKey, now);
    if (window === null) {
      this.windows.set(clientKey, { failedAttempts: 1, startedAt: now });
      return;
    }
    window.failedAttempts++;
  }

  reset(clientKey: string): void {
    this.windows.delete(clientKey);
  }

  private loadActiveWindow(clientKey: string, now: number): AttemptWindow | null {
    const window = this.windows.get(clientKey);
    if (window === undefined) return null;
    if (now - window.startedAt < WINDOW_MS) return window;
    this.windows.delete(clientKey);
    return null;
  }
}
