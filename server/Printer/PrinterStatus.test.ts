import { describe, expect, it } from 'vitest';
import { mergeReport, toPrinterStatus } from './PrinterStatus';

const FULL_REPORT = {
  print: {
    command: 'push_status',
    gcode_state: 'RUNNING',
    mc_percent: 63,
    mc_remaining_time: 42,
    subtask_name: 'Flexi Drache',
    gcode_file: '/data/Metadata/plate_1.gcode',
    layer_num: 120,
    total_layer_num: 300,
    nozzle_temper: 219.8,
    bed_temper: 55.0,
  },
};

describe('mergeReport', () => {
  it('shouldKeepFieldsMissingInDeltaReport', () => {
    const afterFull = mergeReport({}, FULL_REPORT);

    const afterDelta = mergeReport(afterFull, { print: { mc_percent: 64 } });

    expect(afterDelta.mc_percent).toBe(64);
    expect(afterDelta.subtask_name).toBe('Flexi Drache');
  });

  it.each([[null], ['text'], [{}], [{ info: { command: 'get_version' } }], [{ print: null }]])(
    'shouldIgnoreReportWithoutPrintSection %j',
    (report) => {
      const previous = { mc_percent: 10 };

      expect(mergeReport(previous, report)).toBe(previous);
    },
  );
});

describe('toPrinterStatus', () => {
  it('shouldMapRunningReport', () => {
    const status = toPrinterStatus(mergeReport({}, FULL_REPORT), true, new Date('2026-10-19T10:00:00Z'));

    expect(status).toEqual({
      isConnected: true,
      state: 'printing',
      progressPercent: 63,
      remainingMinutes: 42,
      jobName: 'Flexi Drache',
      currentLayer: 120,
      totalLayers: 300,
      nozzleTemperature: 220,
      bedTemperature: 55,
      updatedAt: '2026-10-19T10:00:00.000Z',
      amsTrays: [],
      jobKey: 'Flexi Drache|/data/Metadata/plate_1.gcode',
    });
  });

  it.each([
    ['IDLE', 'idle'],
    ['PREPARE', 'preparing'],
    ['SLICING', 'preparing'],
    ['RUNNING', 'printing'],
    ['PAUSE', 'paused'],
    ['FINISH', 'finished'],
    ['FAILED', 'failed'],
    ['running', 'printing'],
    ['SOMETHING_NEW', 'idle'],
    [undefined, 'idle'],
  ])('shouldMapGcodeState %s to %s', (gcodeState, expected) => {
    expect(toPrinterStatus({ gcode_state: gcodeState }, true, null).state).toBe(expected);
  });

  it('shouldReportOfflineWhenDisconnected', () => {
    expect(toPrinterStatus({ gcode_state: 'RUNNING' }, false, null).state).toBe('offline');
  });

  it.each([
    [-5, 0],
    [150, 100],
    ['42', 42],
    [42.6, 43],
    ['abc', null],
    [null, null],
  ])('shouldClampPercent %j to %j', (value, expected) => {
    expect(toPrinterStatus({ mc_percent: value }, true, null).progressPercent).toBe(expected);
  });

  it('shouldRejectNegativeRemainingTime', () => {
    expect(toPrinterStatus({ mc_remaining_time: -1 }, true, null).remainingMinutes).toBeNull();
  });

  it.each([
    [{ subtask_name: '  ', gcode_file: '/sdcard/Schlüsselanhänger.gcode.3mf' }, 'Schlüsselanhänger'],
    [{ gcode_file: 'Vase.gcode' }, 'Vase'],
    [{ gcode_file: '' }, null],
    [{}, null],
  ])('shouldDeriveJobName %j', (raw, expected) => {
    expect(toPrinterStatus(raw, true, null).jobName).toBe(expected);
  });

  it.each([
    [{ task_id: '1353746811', lan_task_id: '0' }, '1353746811'],
    [{ task_id: '0', lan_task_id: '987' }, '987'],
    [{ task_id: 42 }, '42'],
    [{ task_id: '0', subtask_name: 'Vase', gcode_file: 'plate_1.gcode' }, 'Vase|plate_1.gcode'],
    [{}, null],
  ])('shouldDeriveJobKey %j', (raw, expected) => {
    expect(toPrinterStatus(raw, true, null).jobKey).toBe(expected);
  });
});
