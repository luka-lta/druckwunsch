import { describe, expect, it } from 'vitest';
import type { PrintRequestStatus } from '../../shared/api';
import type { ColorHex } from '../../shared/ColorHex';
import type { UserId } from '../Auth/Session';
import type { Filament, FilamentId } from '../Filament/Repository/FilamentRepository';
import type { PrintRequest, PrintRequestId } from '../PrintRequest/Repository/PrintRequestRepository';
import { computeStatistics, MONTH_COUNT, TOP_COLOR_COUNT } from './Statistics';

const NOW = new Date('2026-10-19T10:00:00Z');

let nextId = 1;

function request(fields: {
  requester?: string;
  status?: PrintRequestStatus;
  quantity?: number;
  color?: string;
  createdAt?: string;
  completedAt?: string | null;
}): PrintRequest {
  const id = nextId++;
  return {
    id: id as PrintRequestId,
    userId: 1 as UserId,
    requesterName: fields.requester ?? 'Oma',
    modelId: String(id),
    url: `https://makerworld.com/de/models/${id}`,
    title: `Modell ${id}`,
    imageUrl: null,
    color: fields.color ?? '',
    quantity: fields.quantity ?? 1,
    note: '',
    status: fields.status ?? 'new',
    createdAt: fields.createdAt ?? '2026-10-10T10:00:00.000Z',
    updatedAt: fields.createdAt ?? '2026-10-10T10:00:00.000Z',
    completedAt: fields.completedAt ?? null,
    printJobId: null,
    printJobName: null,
    filamentGrams: null,
    isUrgent: false,
    position: null,
  };
}

describe('computeStatistics', () => {
  it('shouldReturnZerosWithoutRequests', () => {
    const statistics = computeStatistics([], [], 0, NOW);

    expect(statistics).toMatchObject({
      totalRequests: 0,
      printedPieces: 0,
      openRequests: 0,
      averageWaitHours: null,
      topRequesters: [],
      topColors: [],
    });
    expect(statistics.requestsPerMonth).toHaveLength(MONTH_COUNT);
    expect(statistics.requestsPerMonth.every((month) => month.count === 0)).toBe(true);
  });

  it('shouldCountPrintedPiecesOnlyForDoneAndCollected', () => {
    const statistics = computeStatistics(
      [
        request({ status: 'done', quantity: 2 }),
        request({ status: 'collected', quantity: 3 }),
        request({ status: 'printing', quantity: 5 }),
        request({ status: 'rejected', quantity: 7 }),
      ],
      [], 0, NOW);

    expect(statistics.printedPieces).toBe(5);
    expect(statistics.openRequests).toBe(1);
    expect(statistics.totalRequests).toBe(4);
  });

  it('shouldAverageWaitFromCreationToCompletion', () => {
    const statistics = computeStatistics(
      [
        request({ status: 'done', createdAt: '2026-10-01T10:00:00Z', completedAt: '2026-10-01T22:00:00Z' }),
        request({ status: 'collected', createdAt: '2026-10-02T10:00:00Z', completedAt: '2026-10-03T22:00:00Z' }),
        request({ status: 'done', completedAt: null }),
      ],
      [], 0, NOW);

    expect(statistics.averageWaitHours).toBe(24);
  });

  it('shouldIgnoreCompletionBeforeCreation', () => {
    const statistics = computeStatistics(
      [request({ status: 'done', createdAt: '2026-10-05T10:00:00Z', completedAt: '2026-10-01T10:00:00Z' })],
      [], 0, NOW);

    expect(statistics.averageWaitHours).toBeNull();
  });

  it('shouldCountRequestsPerMonthForLastTwelveMonthsEndingNow', () => {
    const statistics = computeStatistics(
      [
        request({ createdAt: '2026-10-01T08:00:00Z' }),
        request({ createdAt: '2026-10-18T08:00:00Z' }),
        request({ createdAt: '2025-11-15T08:00:00Z' }),
        request({ createdAt: '2025-10-15T08:00:00Z' }),
      ],
      [], 0, NOW);

    expect(statistics.requestsPerMonth[0]).toEqual({ month: '2025-11', count: 1 });
    expect(statistics.requestsPerMonth.at(-1)).toEqual({ month: '2026-10', count: 2 });
  });

  it('shouldAssignMonthInGermanTime', () => {
    // 30.09. 23:30 UTC ist in Deutschland bereits der 1. Oktober
    const statistics = computeStatistics([request({ createdAt: '2026-09-30T23:30:00Z' })], [], 0, NOW);

    expect(statistics.requestsPerMonth.at(-1)).toEqual({ month: '2026-10', count: 1 });
  });

  it('shouldRankRequestersByCountThenName', () => {
    const statistics = computeStatistics(
      [
        request({ requester: 'Papa' }),
        request({ requester: 'Oma', status: 'done', quantity: 3 }),
        request({ requester: 'Oma' }),
        request({ requester: 'Lea' }),
      ],
      [], 0, NOW);

    expect(statistics.topRequesters).toEqual([
      { name: 'Oma', requestCount: 2, printedPieces: 3 },
      { name: 'Lea', requestCount: 1, printedPieces: 0 },
      { name: 'Papa', requestCount: 1, printedPieces: 0 },
    ]);
  });

  it('shouldGroupColorsByNameWithoutMaterial', () => {
    const latteBrown: Filament = {
      id: 1 as FilamentId,
      name: 'Latte Brown',
      material: 'PLA Matte',
      colorHex: '#AE835B' as ColorHex,
      isAvailable: true,
    };

    const statistics = computeStatistics(
      [
        request({ color: 'Grün (PLA Basic)' }),
        request({ color: 'grün' }),
        request({ color: '' }),
        request({ color: 'Latte Brown (PLA Matte)' }),
        request({ color: 'Silk Gold' }),
      ],
      [latteBrown], 0, NOW);

    expect(statistics.topColors).toEqual([
      { name: 'Grün', colorHex: '#22C55E', count: 2 },
      { name: 'Egal', colorHex: null, count: 1 },
      { name: 'Latte Brown', colorHex: '#AE835B', count: 1 },
      { name: 'Silk Gold', colorHex: null, count: 1 },
    ]);
  });

  it('shouldFoldRareColorsIntoOther', () => {
    const colors = Array.from({ length: TOP_COLOR_COUNT + 3 }, (_, index) => `Farbe ${String(index).padStart(2, '0')}`);

    const statistics = computeStatistics(colors.map((color) => request({ color })), [], 0, NOW);

    expect(statistics.topColors).toHaveLength(TOP_COLOR_COUNT + 1);
    expect(statistics.topColors.at(-1)).toEqual({ name: 'Andere', colorHex: null, count: 3 });
  });

  it('shouldNotFoldWhenOnlyOneColorWouldBeOther', () => {
    const colors = Array.from({ length: TOP_COLOR_COUNT + 1 }, (_, index) => `Farbe ${index}`);

    const statistics = computeStatistics(colors.map((color) => request({ color })), [], 0, NOW);

    expect(statistics.topColors.map((entry) => entry.name)).not.toContain('Andere');
  });

  it('shouldResolveSwatchFromBambuCatalog', () => {
    const catalog = {
      findByName: (name: string, productLine: string | null) => (name === 'Kohlschwarz' && productLine === 'PLA Matte'
        ? { code: '11101', filamentId: 'GFA01', colorCode: 'K1', productLine: 'PLA Matte', name, colors: ['#000000' as ColorHex] }
        : null),
    };

    const statistics = computeStatistics([request({ color: 'Kohlschwarz (PLA Matte)' })], [], 0, NOW, catalog);

    expect(statistics.topColors).toEqual([{ name: 'Kohlschwarz', colorHex: '#000000', count: 1 }]);
  });
});
