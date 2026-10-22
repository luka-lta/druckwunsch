import { describe, expect, it } from 'vitest';
import { parseMakerWorldLink } from './MakerWorldLink';

describe('parseMakerWorldLink', () => {
  it.each([
    ['https://makerworld.com/de/models/123456-handyhalter', 'https://makerworld.com/de/models/123456-handyhalter'],
    ['https://makerworld.com/en/models/123456-phone-stand', 'https://makerworld.com/de/models/123456-phone-stand'],
    ['https://www.makerworld.com/models/123456', 'https://makerworld.com/de/models/123456'],
    ['https://makerworld.com/en-us/models/123456-foo/', 'https://makerworld.com/de/models/123456-foo'],
    ['  https://makerworld.com/de/models/123456  ', 'https://makerworld.com/de/models/123456'],
    ['http://MAKERWORLD.com/de/models/123456', 'https://makerworld.com/de/models/123456'],
  ])('shouldNormalizeValidModelUrl %s', (input, expectedUrl) => {
    const link = parseMakerWorldLink(input);

    expect(link?.url).toBe(expectedUrl);
  });

  it('shouldKeepPrintProfileFragment', () => {
    const link = parseMakerWorldLink('https://makerworld.com/de/models/123456-vase#profileId-987654');

    expect(link?.url).toBe('https://makerworld.com/de/models/123456-vase#profileId-987654');
  });

  it('shouldDropUnknownFragmentAndQuery', () => {
    const link = parseMakerWorldLink('https://makerworld.com/de/models/123456-vase?from=search#comments');

    expect(link?.url).toBe('https://makerworld.com/de/models/123456-vase');
  });

  it.each([
    [''],
    ['keine url'],
    ['https://printables.com/model/123456-foo'],
    ['https://makerworld.com.evil.tld/de/models/123456'],
    ['https://makerworld.com/de/collections/123456'],
    ['https://makerworld.com/de/models/abc'],
    ['https://makerworld.com/'],
    ['javascript:alert(1)'],
    ['ftp://makerworld.com/de/models/123456'],
  ])('shouldRejectInvalidUrl %j', (input) => {
    expect(parseMakerWorldLink(input)).toBeNull();
  });

  it('shouldExtractModelId', () => {
    expect(parseMakerWorldLink('https://makerworld.com/de/models/987-x')?.modelId).toBe('987');
  });

  it.each([
    ['https://makerworld.com/de/models/1-phone-stand', 'Phone stand'],
    ['https://makerworld.com/de/models/1-k%C3%BCchenhaken', 'Küchenhaken'],
    ['https://makerworld.com/de/models/1-%E0%A4%A', '%E0%A4%A'],
    ['https://makerworld.com/de/models/42', 'Modell 42'],
  ])('shouldDeriveFallbackTitleFromSlug %s', (input, expectedTitle) => {
    expect(parseMakerWorldLink(input)?.fallbackTitle).toBe(expectedTitle);
  });

  it.each([
    ['Schau dir das an: https://makerworld.com/de/models/701373-skull-lamp', 'https://makerworld.com/de/models/701373-skull-lamp'],
    ['Check out "Skull Lamp" on MakerWorld!\nhttps://makerworld.com/en/models/701373?from=share', 'https://makerworld.com/de/models/701373'],
    ['(https://makerworld.com/de/models/701373).', 'https://makerworld.com/de/models/701373'],
  ])('shouldFindLinkInShareText %j', (input, expectedUrl) => {
    expect(parseMakerWorldLink(input)?.url).toBe(expectedUrl);
  });

  it.each([
    ['Schau mal: https://printables.com/model/123'],
    ['https://makerworld.com.evil.tld/de/models/123 und mehr'],
    ['Text ohne Link'],
  ])('shouldRejectShareTextWithoutMakerWorldModel %j', (input) => {
    expect(parseMakerWorldLink(input)).toBeNull();
  });
});
