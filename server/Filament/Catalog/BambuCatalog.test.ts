import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BambuCatalog, parseCatalog } from './BambuCatalog';

// Aufbau entspricht filaments_color_codes.json aus Bambu Studio
const CATALOG_JSON = {
  data: [
    {
      fila_color_code: '10501',
      fila_id: 'GFA00',
      fila_type: 'PLA Basic',
      fila_color_name: { de: 'Bambusgrün', en: 'Bambu Green' },
      color_code: 'G6',
      fila_color: ['#00AE42FF'],
    },
    {
      fila_color_code: '11101',
      fila_id: 'GFA01',
      fila_type: 'PLA Matte',
      fila_color_name: { de: 'Kohlschwarz', en: 'Charcoal' },
      color_code: 'K1',
      fila_color: ['#000000FF'],
    },
    {
      fila_color_code: '10900',
      fila_id: 'GFA00',
      fila_type: 'PLA Basic',
      fila_color_name: { en: 'Arctic Whisper' },
      color_code: 'M0',
      fila_color: ['#9CDBD9FF', '#FFFFFFFF'],
    },
    { fila_color_code: '99999', fila_id: 'GFX99', fila_type: 'Kaputt', fila_color: [] },
  ],
};

function createCatalog(): BambuCatalog {
  const catalog = new BambuCatalog('');
  catalog.replaceEntries(parseCatalog(CATALOG_JSON));
  return catalog;
}

describe('parseCatalog', () => {
  it('shouldParseEntriesWithGermanNameAndStripAlpha', () => {
    expect(parseCatalog(CATALOG_JSON)[0]).toEqual({
      code: '10501',
      filamentId: 'GFA00',
      colorCode: 'G6',
      productLine: 'PLA Basic',
      name: 'Bambusgrün',
      colors: ['#00AE42'],
    });
  });

  it('shouldFallBackToEnglishName', () => {
    expect(parseCatalog(CATALOG_JSON)[2]?.name).toBe('Arctic Whisper');
  });

  it('shouldKeepAllColorsOfMultiColorFilament', () => {
    expect(parseCatalog(CATALOG_JSON)[2]?.colors).toEqual(['#9CDBD9', '#FFFFFF']);
  });

  it('shouldSkipEntryWithoutColor', () => {
    expect(parseCatalog(CATALOG_JSON).map((entry) => entry.code)).not.toContain('99999');
  });

  it.each([[null], ['text'], [{}], [{ data: 'kaputt' }]])('shouldReturnEmptyListForInvalidJson %j', (json) => {
    expect(parseCatalog(json)).toEqual([]);
  });
});

describe('BambuCatalog', () => {
  it('shouldFindAmsSpoolByTrayInfoAndTrayIdName', () => {
    expect(createCatalog().findByTray('GFA00', 'A00-G6')?.name).toBe('Bambusgrün');
  });

  it.each([
    [null, 'A00-G6'],
    ['GFA00', null],
    ['GFA00', 'A00'],
    ['GFA01', 'A00-G6'],
  ])('shouldNotMatchIncompleteOrWrongTray %j %j', (trayInfoIdx, trayIdName) => {
    expect(createCatalog().findByTray(trayInfoIdx, trayIdName)).toBeNull();
  });

  it('shouldFindByCode', () => {
    expect(createCatalog().findByCode('11101')?.name).toBe('Kohlschwarz');
  });

  it.each([
    ['grün', ['10501']],
    ['pla basic', ['10900', '10501']],
    ['Kohl matte', ['11101']],
    ['10501', ['10501']],
    ['pla-basic grün', ['10501']],
  ])('shouldSearch %j', (query, expectedCodes) => {
    expect(createCatalog().search(query).map((entry) => entry.code)).toEqual(expectedCodes);
  });

  it('shouldReturnNothingForBlankQuery', () => {
    expect(createCatalog().search('   ')).toEqual([]);
  });

  it('shouldDownloadAndCacheCatalog', async () => {
    const cachePath = join(mkdtempSync(join(tmpdir(), 'druckwunsch-')), 'catalog.json');
    const fakeFetch = (async () => Response.json(CATALOG_JSON)) as unknown as typeof fetch;
    const catalog = new BambuCatalog(cachePath, fakeFetch);

    await catalog.start();
    catalog.stop();

    expect(catalog.getEntryCount()).toBe(3);
    expect(JSON.parse(readFileSync(cachePath, 'utf8'))).toEqual(CATALOG_JSON);
  });

  it('shouldKeepCachedCatalogWhenDownloadFails', async () => {
    const cachePath = join(mkdtempSync(join(tmpdir(), 'druckwunsch-')), 'catalog.json');
    const workingFetch = (async () => Response.json(CATALOG_JSON)) as unknown as typeof fetch;
    const first = new BambuCatalog(cachePath, workingFetch);
    await first.start();
    first.stop();

    const failingFetch = (async () => new Response('', { status: 500 })) as unknown as typeof fetch;
    const second = new BambuCatalog(cachePath, failingFetch);
    await second.start();
    second.stop();

    expect(second.getEntryCount()).toBe(3);
  });

  it.each([
    ['Kohlschwarz', 'PLA Matte', '11101'],
    ['kohlschwarz', null, '11101'],
    ['Kohlschwarz', 'PLA Basic', null],
    ['Unbekannt', null, null],
  ])('shouldFindByName %j %j', (name, productLine, expectedCode) => {
    expect(createCatalog().findByName(name, productLine)?.code ?? null).toBe(expectedCode);
  });
});
