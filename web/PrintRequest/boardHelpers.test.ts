import { describe, expect, it } from 'vitest';
import type { AmsTrayResponse, FilamentResponse, PrinterStatusResponse, PrintRequestResponse } from '../../shared/api';
import { findLoadedOption } from '../Filament/colorMatch';
import { toFilamentOptions } from '../Filament/filamentOptions';
import { toLiveProgress } from '../Printer/liveProgress';
import { toBatchGroups } from './batchGroups';

function request(fields: Partial<PrintRequestResponse>): PrintRequestResponse {
  return {
    id: 1,
    requesterName: 'Oma',
    isOwn: false,
    url: 'https://makerworld.com/de/models/1',
    title: 'Vase',
    imageUrl: null,
    color: '',
    quantity: 1,
    note: '',
    status: 'accepted',
    createdAt: '2026-10-19T10:00:00Z',
    updatedAt: '2026-10-19T10:00:00Z',
    printJobName: null,
    filamentGrams: null,
    isUrgent: false,
    ...fields,
  };
}

function tray(slot: string, colorHex: string, catalogName: string | null, subBrand = 'PLA Basic'): AmsTrayResponse {
  return { slot, colorHex, material: 'PLA', subBrand, remainPercent: 50, remainingGrams: 500, catalogName, catalogCode: null };
}

const OPTIONS = toFilamentOptions(
  [tray('A1', '#000000', 'Kohlschwarz', 'PLA Matte'), tray('A2', '#00AE42', 'Bambusgrün')],
  [],
);

describe('findLoadedOption', () => {
  it.each([
    ['Bambusgrün (PLA Basic)', 'A2'],
    ['bambusgrün', 'A2'],
    ['Kohlschwarz (PLA Matte)', 'A1'],
    ['Grün (PLA Basic)', 'A2'],
    ['schwarz', 'A1'],
  ])('shouldFindLoadedSpoolFor %j', (color, slot) => {
    expect(findLoadedOption(color, OPTIONS)?.slot).toBe(slot);
  });

  it.each([['Rot'], ['Silk Gold (PLA Silk)'], ['Blau']])('shouldNotMatch %j', (color) => {
    expect(findLoadedOption(color, OPTIONS)).toBeNull();
  });

  it('shouldIgnoreLibrarySpoolsThatAreNotLoaded', () => {
    const library: FilamentResponse[] = [{ id: 1, name: 'Silk Gold', material: 'PLA Silk', colorHex: '#D4AF37', isAvailable: true }];

    expect(findLoadedOption('Silk Gold (PLA Silk)', toFilamentOptions([], library))).toBeNull();
  });
});

describe('toBatchGroups', () => {
  it('shouldGroupAcceptedRequestsByColorIgnoringMaterialAndCase', () => {
    const groups = toBatchGroups([
      request({ id: 1, color: 'Bambusgrün (PLA Basic)' }),
      request({ id: 2, color: 'bambusgrün' }),
      request({ id: 3, color: 'Rot' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.requests.map((entry) => entry.id)).toEqual([1, 2]);
  });

  it('shouldIgnoreAnyColorAndOtherStatuses', () => {
    const groups = toBatchGroups([
      request({ id: 1, color: '' }),
      request({ id: 2, color: '' }),
      request({ id: 3, color: 'Rot', status: 'new' }),
      request({ id: 4, color: 'Rot' }),
    ]);

    expect(groups).toEqual([]);
  });
});

describe('toLiveProgress', () => {
  const printer = {
    isEnabled: true,
    isConnected: true,
    state: 'printing',
    progressPercent: 63,
    remainingMinutes: 42,
    jobName: 'Gridfinity Bins',
  } as PrinterStatusResponse;

  it('shouldShowProgressForLinkedPrintingRequest', () => {
    const progress = toLiveProgress(request({ status: 'printing', printJobName: 'Gridfinity Bins' }), printer);

    expect(progress).toEqual({ percent: 63, remainingMinutes: 42 });
  });

  it.each([
    [request({ status: 'printing', printJobName: 'Anderer Druck' })],
    [request({ status: 'printing', printJobName: null })],
    [request({ status: 'done', printJobName: 'Gridfinity Bins' })],
  ])('shouldNotShowProgressForUnrelatedRequest %#', (entry) => {
    expect(toLiveProgress(entry, printer)).toBeNull();
  });

  it('shouldNotShowProgressWhenPrinterIsIdle', () => {
    const idle = { ...printer, state: 'idle' } as PrinterStatusResponse;

    expect(toLiveProgress(request({ status: 'printing', printJobName: 'Gridfinity Bins' }), idle)).toBeNull();
  });
});
