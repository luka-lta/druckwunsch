import { beforeEach, describe, expect, it } from 'vitest';
import type { PrinterState } from '../../shared/api';
import { UserRepository } from '../Auth/Repository/UserRepository';
import { parseUserName } from '../Auth/Session';
import { openDatabase } from '../Database';
import { parseMakerWorldLink } from '../PrintRequest/MakerWorldLink';
import { PrintRequestRepository, type PrintRequestId } from '../PrintRequest/Repository/PrintRequestRepository';
import { completePrintOnFinish } from './PrintCompletion';

const NOW = new Date('2026-10-19T10:00:00Z');

describe('completePrintOnFinish', () => {
  let printRequests: PrintRequestRepository;
  let createRequest: () => PrintRequestId;

  beforeEach(() => {
    const database = openDatabase(':memory:');
    printRequests = new PrintRequestRepository(database);
    const userName = parseUserName('Oma');
    const link = parseMakerWorldLink('https://makerworld.com/de/models/123456-vase');
    if (userName === null || link === null) throw new Error('Invalid test fixture');
    const user = new UserRepository(database).loadOrCreateUser(userName, NOW);

    createRequest = () => printRequests.createPrintRequest(
      user.id,
      { link, title: null, color: '', quantity: 1, note: '', isSaved: false },
      { title: 'Vase', imageUrl: null },
      NOW,
    );
  });

  it('shouldCompleteSinglePrintingRequestWhenPrintFinishes', () => {
    const id = createRequest();
    printRequests.updateStatus(id, 'printing', NOW);

    const completed = completePrintOnFinish('printing', 'finished', printRequests, NOW);

    expect(completed?.id).toBe(id);
    expect(printRequests.loadPrintRequest(id)?.status).toBe('done');
  });

  it('shouldCompleteAfterPausedPrintFinishes', () => {
    const id = createRequest();
    printRequests.updateStatus(id, 'printing', NOW);

    expect(completePrintOnFinish('paused', 'finished', printRequests, NOW)?.id).toBe(id);
  });

  it('shouldNotGuessWhenSeveralRequestsArePrinting', () => {
    const first = createRequest();
    const second = createRequest();
    printRequests.updateStatus(first, 'printing', NOW);
    printRequests.updateStatus(second, 'printing', NOW);

    expect(completePrintOnFinish('printing', 'finished', printRequests, NOW)).toBeNull();
    expect(printRequests.loadPrintRequest(first)?.status).toBe('printing');
  });

  it('shouldDoNothingWithoutPrintingRequest', () => {
    const id = createRequest();
    printRequests.updateStatus(id, 'accepted', NOW);

    expect(completePrintOnFinish('printing', 'finished', printRequests, NOW)).toBeNull();
    expect(printRequests.loadPrintRequest(id)?.status).toBe('accepted');
  });

  it.each<[PrinterState, PrinterState]>([
    ['offline', 'finished'],
    ['idle', 'finished'],
    ['printing', 'failed'],
    ['printing', 'paused'],
    ['preparing', 'printing'],
  ])('shouldIgnoreTransition %s → %s', (previous, current) => {
    const id = createRequest();
    printRequests.updateStatus(id, 'printing', NOW);

    expect(completePrintOnFinish(previous, current, printRequests, NOW)).toBeNull();
    expect(printRequests.loadPrintRequest(id)?.status).toBe('printing');
  });
});
