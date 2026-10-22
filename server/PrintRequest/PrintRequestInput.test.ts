import { describe, expect, it } from 'vitest';
import { MAX_QUANTITY } from '../../shared/api';
import { MAX_COLOR_LENGTH, MAX_NOTE_LENGTH, parsePrintRequestInput } from './PrintRequestInput';

const VALID_URL = 'https://makerworld.com/de/models/123456-handyhalter';

describe('parsePrintRequestInput', () => {
  it('shouldParseValidInputAndTrimText', () => {
    const result = parsePrintRequestInput({ url: VALID_URL, color: ' Schwarz ', quantity: 2, note: ' bis Samstag ' });

    expect(result.isOk).toBe(true);
    if (!result.isOk) return;
    expect(result.value.color).toBe('Schwarz');
    expect(result.value.note).toBe('bis Samstag');
    expect(result.value.quantity).toBe(2);
    expect(result.value.link.modelId).toBe('123456');
  });

  it('shouldAcceptMissingColorAndNote', () => {
    const result = parsePrintRequestInput({ url: VALID_URL, quantity: 1 });

    expect(result).toMatchObject({ isOk: true, value: { color: '', note: '' } });
  });

  it.each([[null], ['text'], [42], [[]]])('shouldRejectNonObjectBody %j', (body) => {
    expect(parsePrintRequestInput(body).isOk).toBe(false);
  });

  it.each([[undefined], [''], ['https://printables.com/model/1'], [123]])('shouldRejectInvalidUrl %j', (url) => {
    expect(parsePrintRequestInput({ url, quantity: 1 }).isOk).toBe(false);
  });

  it.each([[0], [-1], [1.5], [MAX_QUANTITY + 1], ['2'], [null], [Number.NaN]])(
    'shouldRejectInvalidQuantity %j',
    (quantity) => {
      expect(parsePrintRequestInput({ url: VALID_URL, quantity }).isOk).toBe(false);
    },
  );

  it.each([[1], [MAX_QUANTITY]])('shouldAcceptQuantityAtBoundary %d', (quantity) => {
    expect(parsePrintRequestInput({ url: VALID_URL, quantity }).isOk).toBe(true);
  });

  it('shouldCountCharactersNotBytesForColorLength', () => {
    const color = 'ü'.repeat(MAX_COLOR_LENGTH);

    expect(parsePrintRequestInput({ url: VALID_URL, quantity: 1, color }).isOk).toBe(true);
    expect(parsePrintRequestInput({ url: VALID_URL, quantity: 1, color: `${color}x` }).isOk).toBe(false);
  });

  it('shouldRejectTooLongNote', () => {
    const note = 'a'.repeat(MAX_NOTE_LENGTH + 1);

    expect(parsePrintRequestInput({ url: VALID_URL, quantity: 1, note }).isOk).toBe(false);
  });

  it('shouldTreatMissingOrBlankTitleAsNull', () => {
    const missing = parsePrintRequestInput({ url: VALID_URL, quantity: 1 });
    const blank = parsePrintRequestInput({ url: VALID_URL, quantity: 1, title: '   ' });

    expect(missing).toMatchObject({ isOk: true, value: { title: null } });
    expect(blank).toMatchObject({ isOk: true, value: { title: null } });
  });

  it('shouldNormalizeTitleWhitespace', () => {
    const result = parsePrintRequestInput({ url: VALID_URL, quantity: 1, title: '  Totenkopf \n Lampe ' });

    expect(result).toMatchObject({ isOk: true, value: { title: 'Totenkopf Lampe' } });
  });

  it('shouldRejectTooLongTitle', () => {
    expect(parsePrintRequestInput({ url: VALID_URL, quantity: 1, title: 'ä'.repeat(151) }).isOk).toBe(false);
  });
});
