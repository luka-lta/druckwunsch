import { describe, expect, it } from 'vitest';
import { MAX_FILAMENT_NAME_LENGTH, MAX_MATERIAL_LENGTH, parseFilamentInput } from './FilamentInput';

const VALID = { name: 'Silk Gold', material: 'PLA', colorHex: '#d4af37', isAvailable: true };

describe('parseFilamentInput', () => {
  it('shouldParseAndNormalizeValidInput', () => {
    const result = parseFilamentInput({ ...VALID, name: '  Silk   Gold ', material: ' PLA ' });

    expect(result).toEqual({
      isOk: true,
      value: { name: 'Silk Gold', material: 'PLA', colorHex: '#D4AF37', isAvailable: true },
    });
  });

  it.each([[null], ['text'], [42]])('shouldRejectNonObjectBody %j', (body) => {
    expect(parseFilamentInput(body).isOk).toBe(false);
  });

  it.each([
    ['name', ''],
    ['name', '   '],
    ['name', 'ä'.repeat(MAX_FILAMENT_NAME_LENGTH + 1)],
    ['material', ''],
    ['material', 'x'.repeat(MAX_MATERIAL_LENGTH + 1)],
    ['colorHex', 'gold'],
    ['colorHex', '#fff'],
    ['isAvailable', 'true'],
    ['isAvailable', undefined],
  ])('shouldRejectInvalid %s %j', (field, value) => {
    expect(parseFilamentInput({ ...VALID, [field]: value }).isOk).toBe(false);
  });

  it('shouldAcceptNameAtMaximumLength', () => {
    expect(parseFilamentInput({ ...VALID, name: 'ä'.repeat(MAX_FILAMENT_NAME_LENGTH) }).isOk).toBe(true);
  });
});
