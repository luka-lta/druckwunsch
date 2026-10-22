import { describe, expect, it } from 'vitest';
import { parseAmsTrays, toRemainingGrams } from './AmsTray';

function tray(id: string, fields: Record<string, unknown>): Record<string, unknown> {
  return { id, tray_diameter: '1.75', total_len: 330000, ...fields };
}

// Aufbau entspricht einer echten Meldung eines P2S mit AMS
const REPORT_FIELDS = {
  ams: {
    ams: [
      {
        id: '0',
        humidity: '2',
        tray: [
          tray('0', { tray_type: 'PLA', tray_sub_brands: 'PLA Matte', tray_color: '000000FF', remain: 40, tray_info_idx: 'GFA01', tray_id_name: 'A01-K1' }),
          tray('1', { tray_type: 'PLA', tray_sub_brands: 'PLA Basic', tray_color: '00AE42FF', remain: 100 }),
          tray('2', { tray_type: '', tray_color: '00000000', remain: 0 }),
          tray('3', { tray_type: 'PETG', tray_sub_brands: '', tray_color: 'ae835bff', remain: -1 }),
        ],
      },
    ],
    tray_now: '255',
  },
  vir_slot: [tray('255', { tray_type: '', tray_color: '00000000', remain: 0 })],
};

describe('parseAmsTrays', () => {
  it('shouldParseAllSlotsOfAmsUnit', () => {
    const trays = parseAmsTrays(REPORT_FIELDS);

    expect(trays).toEqual([
      {
        slot: 'A1',
        colorHex: '#000000',
        material: 'PLA',
        subBrand: 'PLA Matte',
        remainPercent: 40,
        trayInfoIdx: 'GFA01',
        trayIdName: 'A01-K1',
        weightGrams: null,
      },
      { slot: 'A2', colorHex: '#00AE42', material: 'PLA', subBrand: 'PLA Basic', remainPercent: 100, trayInfoIdx: null, trayIdName: null, weightGrams: null },
      { slot: 'A3', colorHex: null, material: null, subBrand: null, remainPercent: null, trayInfoIdx: null, trayIdName: null, weightGrams: null },
      { slot: 'A4', colorHex: '#AE835B', material: 'PETG', subBrand: null, remainPercent: null, trayInfoIdx: null, trayIdName: null, weightGrams: null },
    ]);
  });

  it('shouldNameSecondAmsUnitWithLetterB', () => {
    const trays = parseAmsTrays({ ams: { ams: [{ id: '1', tray: [tray('0', { tray_type: 'PLA' })] }] } });

    expect(trays[0]?.slot).toBe('B1');
  });

  it('shouldNameAmsHtUnit', () => {
    const trays = parseAmsTrays({ ams: { ams: [{ id: '128', tray: [tray('0', { tray_type: 'PLA' })] }] } });

    expect(trays[0]?.slot).toBe('HT1-1');
  });

  it('shouldIncludeLoadedExternalSpoolFromVtTray', () => {
    const trays = parseAmsTrays({ vt_tray: tray('254', { tray_type: 'TPU', tray_color: 'FF0000FF', remain: 0 }) });

    expect(trays).toEqual([{ slot: 'Extern', colorHex: '#FF0000', material: 'TPU', subBrand: null, remainPercent: 0, trayInfoIdx: null, trayIdName: null, weightGrams: null }]);
  });

  it('shouldSkipEmptyExternalSpool', () => {
    expect(parseAmsTrays({ vir_slot: [tray('255', { tray_type: '' })] })).toEqual([]);
  });

  it.each([[undefined], [null], ['text'], [{}], [{ ams: 'kaputt' }], [{ ams: [{ id: '0', tray: null }] }]])(
    'shouldReturnEmptyListForUnusableAmsField %j',
    (ams) => {
      expect(parseAmsTrays({ ams })).toEqual([]);
    },
  );

  it.each([['ZZZZZZFF'], ['12'], [42], [null]])('shouldIgnoreInvalidTrayColor %j', (trayColor) => {
    const trays = parseAmsTrays({ ams: { ams: [{ id: '0', tray: [tray('0', { tray_type: 'PLA', tray_color: trayColor })] }] } });

    expect(trays[0]?.colorHex).toBeNull();
  });

  it('shouldReadSpoolWeight', () => {
    const trays = parseAmsTrays({ ams: { ams: [{ id: '0', tray: [tray('0', { tray_type: 'PLA', tray_weight: '1000' })] }] } });

    expect(trays[0]?.weightGrams).toBe(1000);
  });

  it.each([[150, 100], [42.4, 42], ['55', 55]])('shouldNormalizeRemain %j to %j', (remain, expected) => {
    const trays = parseAmsTrays({ ams: { ams: [{ id: '0', tray: [tray('0', { tray_type: 'PLA', remain })] }] } });

    expect(trays[0]?.remainPercent).toBe(expected);
  });
});

describe('toRemainingGrams', () => {
  it.each([
    [40, 1000, 400],
    [100, 1000, 1000],
    [0, 1000, 0],
    [33, 500, 165],
    [7, 250, 18],
  ])('shouldConvert %d %% of %d g to %d g', (remainPercent, weightGrams, expected) => {
    expect(toRemainingGrams({ remainPercent, weightGrams })).toBe(expected);
  });

  it.each([
    [null, 1000],
    [40, null],
    [null, null],
  ])('shouldReturnNullWithoutPercentOrWeight %j %j', (remainPercent, weightGrams) => {
    expect(toRemainingGrams({ remainPercent, weightGrams })).toBeNull();
  });
});
