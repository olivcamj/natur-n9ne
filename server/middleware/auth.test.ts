import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../env';
import { bearerToken, checkPassword, createAdminToken, verifyAdminToken } from './auth';
import { HttpError } from './errors';

const original = { ...env };
afterEach(() => Object.assign(env, original));

const TWELVE_HOURS = 12 * 60 * 60 * 1000;

describe('checkPassword', () => {
  it('accepts the right password and rejects others', () => {
    expect(checkPassword('correct-horse-battery')).toBe(true);
    expect(checkPassword('correct-horse-batter')).toBe(false);
    expect(checkPassword('')).toBe(false);
  });

  it('throws a 503 when ADMIN_PASSWORD is not set', () => {
    env.ADMIN_PASSWORD = undefined;
    expect(() => checkPassword('anything')).toThrow(HttpError);
    expect(() => checkPassword('anything')).toThrow(/not configured/);
  });
});

describe('admin tokens', () => {
  it('round-trips a freshly created token', () => {
    expect(verifyAdminToken(createAdminToken())).toBe(true);
  });

  it('expires after 12 hours', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));
    const token = createAdminToken();

    expect(token.split('.')[0]).toBe(String(Date.now() + TWELVE_HOURS));

    vi.setSystemTime(Date.now() + TWELVE_HOURS);
    expect(verifyAdminToken(token)).toBe(true);

    vi.setSystemTime(Date.now() + 1);
    expect(verifyAdminToken(token)).toBe(false);
  });

  it('is invalidated when ADMIN_PASSWORD changes', () => {
    const token = createAdminToken();
    env.ADMIN_PASSWORD = 'a-new-password';
    expect(verifyAdminToken(token)).toBe(false);
  });

  it('is rejected when ADMIN_PASSWORD is unset', () => {
    const token = createAdminToken();
    env.ADMIN_PASSWORD = undefined;
    expect(verifyAdminToken(token)).toBe(false);
  });

  it('rejects a token whose expiry was extended', () => {
    const [expiresAt, mac] = createAdminToken().split('.');
    expect(verifyAdminToken(`${Number(expiresAt) + 1000}.${mac}`)).toBe(false);
  });

  it('rejects a tampered signature', () => {
    const [expiresAt, mac] = createAdminToken().split('.');
    const flipped = (mac[0] === 'a' ? 'b' : 'a') + mac.slice(1);
    expect(verifyAdminToken(`${expiresAt}.${flipped}`)).toBe(false);
  });

  it.each([
    ['empty', ''],
    ['no signature', `${Date.now() + 1000}`],
    ['empty signature', `${Date.now() + 1000}.`],
    ['non-numeric expiry', 'soon.abcdef'],
    ['fractional expiry', `${Date.now() + 1000.5}`.replace('.', '_') + '.abcdef'],
    ['extra segments', `${Date.now() + 1000}.abc.def`],
    ['unsafe-integer expiry', `${Number.MAX_SAFE_INTEGER + 2}.abcdef`],
  ])('rejects a malformed token (%s)', (_label, token) => {
    expect(verifyAdminToken(token)).toBe(false);
  });
});

describe('bearerToken', () => {
  it.each([
    ['Bearer abc.123', 'abc.123'],
    ['bearer abc.123', 'abc.123'],
    ['BEARER    abc.123  ', 'abc.123'],
  ])('extracts the token from %j', (header, expected) => {
    expect(bearerToken(header)).toBe(expected);
  });

  it.each([undefined, '', 'Basic abc', 'Bearer', 'Bearer ', 'abc.123'])(
    'returns undefined for %j',
    (header) => {
      expect(bearerToken(header)).toBeUndefined();
    },
  );
});
