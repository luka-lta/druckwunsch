import { describe, expect, it } from 'vitest';
import { parseConfig } from './Config';

const BASE_ENV = { FAMILY_CODE: 'familie-geheim', ADMIN_CODE: 'admin-geheim' };

describe('parseConfig', () => {
  it('shouldDisableClientIpHeaderByDefault', () => {
    expect(parseConfig(BASE_ENV).clientIpHeader).toBeNull();
  });

  it.each([
    ['X-Real-IP', 'x-real-ip'],
    [' x-forwarded-for ', 'x-forwarded-for'],
    ['', null],
  ])('shouldParseClientIpHeader %j', (value, expected) => {
    expect(parseConfig({ ...BASE_ENV, CLIENT_IP_HEADER: value }).clientIpHeader).toBe(expected);
  });

  it.each([['x real ip'], ['x-real-ip: 1.2.3.4'], ['ä-header']])('shouldRejectInvalidClientIpHeader %j', (value) => {
    expect(() => parseConfig({ ...BASE_ENV, CLIENT_IP_HEADER: value })).toThrow('CLIENT_IP_HEADER');
  });

  it('shouldRejectEqualCodes', () => {
    expect(() => parseConfig({ FAMILY_CODE: 'gleich-123', ADMIN_CODE: 'gleich-123' })).toThrow('ADMIN_CODE');
  });

  it('shouldRejectTooShortCode', () => {
    expect(() => parseConfig({ ...BASE_ENV, FAMILY_CODE: '12345' })).toThrow('FAMILY_CODE');
  });
});
