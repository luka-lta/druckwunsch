import { describe, expect, it } from 'vitest';
import type { UserId } from '../Auth/Session';
import { UserRepository } from '../Auth/Repository/UserRepository';
import { parseUserName } from '../Auth/Session';
import { openDatabase } from '../Database';
import type { PrintRequest } from '../PrintRequest/Repository/PrintRequestRepository';
import { createExpoPushSender, type PushMessage, type PushSender } from './ExpoPushClient';
import { parseExpoPushToken, type ExpoPushToken } from './PushToken';
import { PushNotifier } from './PushNotifier';
import { PushTokenRepository } from './Repository/PushTokenRepository';

const NOW = new Date('2026-10-25T10:00:00Z');

function token(id: string): ExpoPushToken {
  const parsed = parseExpoPushToken(`ExponentPushToken[${id}]`);
  if (parsed === null) throw new Error('Invalid test token');
  return parsed;
}

function setup() {
  const database = openDatabase(':memory:');
  const users = new UserRepository(database);
  const createUser = (name: string): UserId => {
    const userName = parseUserName(name);
    if (userName === null) throw new Error('Invalid test name');
    return users.loadOrCreateUser(userName, NOW).id;
  };
  return { tokens: new PushTokenRepository(database), createUser };
}

function makeRequest(userId: UserId): PrintRequest {
  return { id: 7, userId, requesterName: 'Lena', title: 'Flexi-Drache' } as unknown as PrintRequest;
}

describe('parseExpoPushToken', () => {
  it.each(['ExponentPushToken[abc123]', 'ExpoPushToken[A-b_C]', '  ExponentPushToken[xyz]  '])('shouldAccept %j', (input) => {
    expect(parseExpoPushToken(input)).toBe(input.trim());
  });

  it.each(['', 'ExponentPushToken[]', 'ExponentPushToken[a b]', 'abc', `ExponentPushToken[${'a'.repeat(300)}]`, null])(
    'shouldReject %j',
    (input) => {
      expect(parseExpoPushToken(input)).toBeNull();
    },
  );
});

describe('PushTokenRepository', () => {
  it('shouldLoadOnlyAdminTokensExceptExcludedUser', () => {
    const { tokens, createUser } = setup();
    const papa = createUser('Papa');
    const luka = createUser('Luka');
    const mama = createUser('Mama');
    tokens.saveToken(token('papa'), papa, 'admin', NOW);
    tokens.saveToken(token('luka'), luka, 'admin', NOW);
    tokens.saveToken(token('mama'), mama, 'family', NOW);

    expect(tokens.loadAdminTokens(luka)).toEqual([token('papa')]);
  });

  it('shouldMoveDeviceToNewlySignedInPerson', () => {
    const { tokens, createUser } = setup();
    const papa = createUser('Papa');
    const mama = createUser('Mama');
    tokens.saveToken(token('device'), papa, 'admin', NOW);

    tokens.saveToken(token('device'), mama, 'family', NOW);

    expect(tokens.loadAdminTokens(null)).toEqual([]);
  });

  it('shouldOnlyDeleteOwnDevice', () => {
    const { tokens, createUser } = setup();
    const papa = createUser('Papa');
    const mama = createUser('Mama');
    tokens.saveToken(token('device'), papa, 'admin', NOW);

    tokens.deleteTokenOfUser(token('device'), mama);

    expect(tokens.loadAdminTokens(null)).toEqual([token('device')]);
  });
});

describe('PushNotifier', () => {
  it('shouldSendNewRequestToAdminsAndForgetUnregisteredDevices', async () => {
    const { tokens, createUser } = setup();
    const papa = createUser('Papa');
    const lena = createUser('Lena');
    tokens.saveToken(token('papa-phone'), papa, 'admin', NOW);
    tokens.saveToken(token('papa-old'), papa, 'admin', NOW);
    const sent: PushMessage[] = [];
    const send: PushSender = async (messages) => {
      sent.push(...messages);
      return { unregisteredTokens: [token('papa-old')] };
    };

    await new PushNotifier(tokens, send).notifyNewRequest(makeRequest(lena));

    expect(sent.map((message) => message.body)).toEqual(['Lena wünscht sich „Flexi-Drache“.', 'Lena wünscht sich „Flexi-Drache“.']);
    expect(sent[0]?.data).toEqual({ requestId: 7 });
    expect(tokens.loadAdminTokens(null)).toEqual([token('papa-phone')]);
  });

  it('shouldNotCallExpoWithoutAdminDevices', async () => {
    const { tokens, createUser } = setup();
    let calls = 0;
    const send: PushSender = async () => {
      calls += 1;
      return { unregisteredTokens: [] };
    };

    await new PushNotifier(tokens, send).notifyNewRequest(makeRequest(createUser('Lena')));

    expect(calls).toBe(0);
  });
});

describe('createExpoPushSender', () => {
  function fakeFetch(responses: unknown[], requests: { body: unknown[]; headers: Record<string, string> }[]): typeof fetch {
    return (async (_url: string, init: RequestInit) => {
      requests.push({ body: JSON.parse(String(init.body)) as unknown[], headers: init.headers as Record<string, string> });
      return new Response(JSON.stringify({ data: responses.shift() }), { status: 200 });
    }) as typeof fetch;
  }

  const message = (id: string): PushMessage => ({ to: token(id), title: 'Titel', body: 'Text', data: {} });

  it('shouldSplitIntoChunksOfHundredMessages', async () => {
    const requests: { body: unknown[]; headers: Record<string, string> }[] = [];
    const send = createExpoPushSender(null, fakeFetch([[], []], requests));

    await send(Array.from({ length: 150 }, (_unused, index) => message(`device${index}`)));

    expect(requests.map((request) => request.body.length)).toEqual([100, 50]);
    expect(requests[0]?.headers.Authorization).toBeUndefined();
  });

  it('shouldReportUnregisteredDevices', async () => {
    const requests: { body: unknown[]; headers: Record<string, string> }[] = [];
    const tickets = [{ status: 'ok', id: 'ticket-1' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }];
    const send = createExpoPushSender('expo-access-token', fakeFetch([tickets], requests));

    const result = await send([message('active'), message('gone')]);

    expect(result.unregisteredTokens).toEqual([token('gone')]);
    expect(requests[0]?.headers.Authorization).toBe('Bearer expo-access-token');
  });

  it('shouldFailOnHttpError', async () => {
    const failing = (async () => new Response('', { status: 500 })) as unknown as typeof fetch;

    await expect(createExpoPushSender(null, failing)([message('device')])).rejects.toThrow('HTTP 500');
  });
});
