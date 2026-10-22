import { describe, expect, it } from 'vitest';
import { parseMakerWorldLink } from './MakerWorldLink';
import { createModelPreviewLoader, parseDesignResponse } from './ModelPreview';

const COVER_URL = 'https://makerworld.bblmw.com/makerworld/model/ABC/design/cover.png';

describe('parseDesignResponse', () => {
  it('shouldExtractTitleAndCover', () => {
    const result = parseDesignResponse({ id: 1, title: 'Flexi Drache', titleTranslated: '', coverUrl: COVER_URL });

    expect(result).toEqual({ title: 'Flexi Drache', imageUrl: COVER_URL });
  });

  it('shouldPreferTranslatedTitle', () => {
    const result = parseDesignResponse({ title: 'Flexi Dragon', titleTranslated: 'Flexibler Drache' });

    expect(result.title).toBe('Flexibler Drache');
  });

  it('shouldCollapseWhitespaceInTitle', () => {
    expect(parseDesignResponse({ title: '  Vase \n  groß  ' }).title).toBe('Vase groß');
  });

  it('shouldTruncateVeryLongTitleByCharacters', () => {
    const result = parseDesignResponse({ title: 'ä'.repeat(500) });

    expect([...(result.title ?? '')].length).toBe(150);
  });

  it.each([
    ['http://makerworld.bblmw.com/cover.png'],
    ['javascript:alert(1)'],
    ['data:image/png;base64,AAAA'],
    ['/relative/cover.png'],
    [''],
    [42],
  ])('shouldRejectNonHttpsCover %j', (coverUrl) => {
    expect(parseDesignResponse({ title: 'X', coverUrl }).imageUrl).toBeNull();
  });

  it.each([[null], ['text'], [42], [{}], [{ title: '' }], [{ title: 7 }]])(
    'shouldReturnNullTitleForUnusableResponse %j',
    (design) => {
      expect(parseDesignResponse(design).title).toBeNull();
    },
  );
});

describe('createModelPreviewLoader', () => {
  const link = parseMakerWorldLink('https://makerworld.com/de/models/701373');
  if (link === null) throw new Error('Invalid test fixture');

  function fakeFetch(response: Response | Error, captured: RequestInit[] = []): typeof fetch {
    return (async (_input: RequestInfo | URL, init?: RequestInit) => {
      captured.push(init ?? {});
      if (response instanceof Error) throw response;
      return response;
    }) as typeof fetch;
  }

  it('shouldUseTitleAndCoverFromMakerWorld', async () => {
    const response = Response.json({ title: 'Gothic Skull Lamp', coverUrl: COVER_URL });

    const preview = await createModelPreviewLoader(fakeFetch(response))(link);

    expect(preview).toEqual({ title: 'Gothic Skull Lamp', imageUrl: COVER_URL });
  });

  // MakerWorld antwortet mit 403, sobald "Accept: application/json" mitgeschickt wird
  it('shouldNotSendJsonAcceptHeader', async () => {
    const captured: RequestInit[] = [];

    await createModelPreviewLoader(fakeFetch(Response.json({}), captured))(link);

    const headers = new Headers(captured[0]?.headers);
    expect(headers.get('accept')).toBeNull();
    expect(headers.get('user-agent')).toContain('Mozilla/5.0');
  });

  it('shouldFallBackToModelIdTitleOnForbidden', async () => {
    const preview = await createModelPreviewLoader(fakeFetch(new Response('', { status: 403 })))(link);

    expect(preview).toEqual({ title: 'Modell 701373', imageUrl: null });
  });

  it('shouldFallBackOnNetworkError', async () => {
    const preview = await createModelPreviewLoader(fakeFetch(new TypeError('fetch failed')))(link);

    expect(preview).toEqual({ title: 'Modell 701373', imageUrl: null });
  });

  it('shouldFallBackOnInvalidJson', async () => {
    const preview = await createModelPreviewLoader(fakeFetch(new Response('<html>')))(link);

    expect(preview.imageUrl).toBeNull();
  });
});
