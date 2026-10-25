import type { PrintRequest } from '../PrintRequest/Repository/PrintRequestRepository';
import type { PushSender } from './ExpoPushClient';
import type { PushTokenRepository } from './Repository/PushTokenRepository';

/** Meldet Ereignisse per Push an die Geräte der Familie */
export class PushNotifier {
  private readonly tokens: PushTokenRepository;
  private readonly send: PushSender;

  constructor(tokens: PushTokenRepository, send: PushSender) {
    this.tokens = tokens;
    this.send = send;
  }

  /** Neuer Wunsch an alle Admins, außer an die Person, die ihn selbst angelegt hat */
  async notifyNewRequest(request: PrintRequest): Promise<void> {
    const tokens = this.tokens.loadAdminTokens(request.userId);
    if (tokens.length === 0) return;

    const result = await this.send(tokens.map((token) => ({
      to: token,
      title: 'Neuer Druckwunsch',
      body: `${request.requesterName} wünscht sich „${request.title}“.`,
      data: { requestId: request.id },
    })));
    this.tokens.deleteTokens(result.unregisteredTokens);
  }
}
