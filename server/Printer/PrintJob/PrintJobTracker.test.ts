import { beforeEach, describe, expect, it } from 'vitest';
import type { PrinterState } from '../../../shared/api';
import { UserRepository } from '../../Auth/Repository/UserRepository';
import { parseUserName } from '../../Auth/Session';
import { openDatabase } from '../../Database';
import { parseMakerWorldLink } from '../../PrintRequest/MakerWorldLink';
import { PrintRequestRepository, type PrintRequestId } from '../../PrintRequest/Repository/PrintRequestRepository';
import type { AmsTray } from '../AmsTray';
import type { PrinterStatus } from '../PrinterStatus';
import { PrintJobRepository } from './PrintJobRepository';
import { PrintJobTracker, toConsumedGrams } from './PrintJobTracker';

const NOW = new Date('2026-10-19T10:00:00Z');

function tray(slot: string, remainPercent: number | null): AmsTray {
  return {
    slot,
    colorHex: null,
    material: 'PLA',
    subBrand: null,
    remainPercent,
    trayInfoIdx: null,
    trayIdName: null,
    weightGrams: 1000,
  };
}

function status(state: PrinterState, trays: AmsTray[], jobKey: string | null = 'job-1'): PrinterStatus {
  return {
    isConnected: true,
    state,
    progressPercent: null,
    remainingMinutes: null,
    jobName: 'Gridfinity Bins',
    currentLayer: null,
    totalLayers: null,
    nozzleTemperature: null,
    bedTemperature: null,
    updatedAt: null,
    amsTrays: trays,
    jobKey,
  };
}

describe('PrintJobTracker', () => {
  let printRequests: PrintRequestRepository;
  let jobs: PrintJobRepository;
  let tracker: PrintJobTracker;
  let createRequest: (quantity?: number) => PrintRequestId;

  beforeEach(() => {
    const database = openDatabase(':memory:');
    printRequests = new PrintRequestRepository(database);
    jobs = new PrintJobRepository(database);
    tracker = new PrintJobTracker(jobs, printRequests, () => NOW);
    const userName = parseUserName('Oma');
    const link = parseMakerWorldLink('https://makerworld.com/de/models/123456-vase');
    if (userName === null || link === null) throw new Error('Invalid test fixture');
    const user = new UserRepository(database).loadOrCreateUser(userName, NOW);

    createRequest = (quantity = 1) => printRequests.createPrintRequest(
      user.id,
      { link, title: null, color: '', quantity, note: '', isSaved: false },
      { title: 'Vase', imageUrl: null },
      NOW,
    );
  });

  it('shouldLinkPrintingRequestsWhenPrintStarts', () => {
    const id = createRequest();
    printRequests.updateStatus(id, 'printing', NOW);

    tracker.handleStateChange('idle', 'printing', status('printing', [tray('A1', 80)]));

    expect(printRequests.loadPrintRequest(id)?.printJobName).toBe('Gridfinity Bins');
    expect(tracker.getActiveJobId()).not.toBeNull();
  });

  it('shouldCompleteAllLinkedRequestsAndSplitFilamentByQuantity', () => {
    const first = createRequest(1);
    const second = createRequest(3);
    printRequests.updateStatus(first, 'printing', NOW);
    printRequests.updateStatus(second, 'printing', NOW);

    tracker.handleStateChange('idle', 'printing', status('printing', [tray('A1', 80), tray('A2', 50)]));
    tracker.handleStateChange('printing', 'finished', status('finished', [tray('A1', 72), tray('A2', 50)]));

    expect(printRequests.loadPrintRequest(first)).toMatchObject({ status: 'done', filamentGrams: 20 });
    expect(printRequests.loadPrintRequest(second)).toMatchObject({ status: 'done', filamentGrams: 60 });
    expect(jobs.loadTotalFilamentGrams()).toBe(80);
  });

  it('shouldNotCreateSecondJobWhenSamePrintIsReportedAgain', () => {
    const id = createRequest();
    printRequests.updateStatus(id, 'printing', NOW);
    tracker.handleStateChange('idle', 'printing', status('printing', [tray('A1', 80)]));
    const firstJobId = tracker.getActiveJobId();

    tracker.handleStateChange('printing', 'paused', status('paused', [tray('A1', 78)]));
    tracker.handleStateChange('paused', 'printing', status('printing', [tray('A1', 78)]));

    expect(tracker.getActiveJobId()).toBe(firstJobId);
  });

  it('shouldKeepRequestsPrintingAndUnlinkThemAfterFailedPrint', () => {
    const id = createRequest();
    printRequests.updateStatus(id, 'printing', NOW);
    tracker.handleStateChange('idle', 'printing', status('printing', [tray('A1', 80)]));

    tracker.handleStateChange('printing', 'failed', status('failed', [tray('A1', 79)]));

    expect(printRequests.loadPrintRequest(id)).toMatchObject({ status: 'printing', printJobId: null });
  });

  it('shouldLinkRequestToNextPrintAfterFailedOne', () => {
    const id = createRequest();
    printRequests.updateStatus(id, 'printing', NOW);
    tracker.handleStateChange('idle', 'printing', status('printing', [tray('A1', 80)], 'job-1'));
    tracker.handleStateChange('printing', 'failed', status('failed', [tray('A1', 79)], 'job-1'));

    tracker.handleStateChange('failed', 'printing', status('printing', [tray('A1', 79)], 'job-2'));
    tracker.handleStateChange('printing', 'finished', status('finished', [tray('A1', 75)], 'job-2'));

    expect(printRequests.loadPrintRequest(id)).toMatchObject({ status: 'done', filamentGrams: 40 });
  });

  it('shouldFallBackToSinglePrintingRequestWithoutTrackedJob', () => {
    const id = createRequest();
    printRequests.updateStatus(id, 'printing', NOW);

    // Server wurde mitten im Druck gestartet: kein Start beobachtet, Druck schon fertig gemeldet
    tracker.handleStateChange('printing', 'finished', status('finished', [], null));

    expect(printRequests.loadPrintRequest(id)?.status).toBe('done');
  });

  it('shouldIgnoreFinishedStateSeenAfterRestart', () => {
    const id = createRequest();
    printRequests.updateStatus(id, 'printing', NOW);

    tracker.handleStateChange('offline', 'finished', status('finished', [tray('A1', 70)]));

    expect(printRequests.loadPrintRequest(id)?.status).toBe('printing');
  });
});

describe('toConsumedGrams', () => {
  it('shouldSumDropsAcrossSpools', () => {
    const start = [
      { slot: 'A1', remainPercent: 80, weightGrams: 1000 },
      { slot: 'A2', remainPercent: 40, weightGrams: 500 },
    ];

    expect(toConsumedGrams(start, [tray('A1', 75), tray('A2', 30)])).toBe(100);
  });

  it('shouldIgnoreRefilledSpool', () => {
    const start = [{ slot: 'A1', remainPercent: 10, weightGrams: 1000 }];

    expect(toConsumedGrams(start, [tray('A1', 100)])).toBe(0);
  });

  it('shouldReturnNullWithoutComparableSpools', () => {
    const start = [{ slot: 'A1', remainPercent: 80, weightGrams: 1000 }];

    expect(toConsumedGrams(start, [tray('A2', 50), tray('A1', null)])).toBeNull();
    expect(toConsumedGrams([], [tray('A1', 50)])).toBeNull();
  });
});
