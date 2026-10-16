import { describe, expect, it } from 'vitest';
import { lastFour, openSecret, sealSecret } from '@/lib/secret-box';

const ENV = { JWT_SECRET: 'a-jwt-secret-that-is-long-enough-123' };

describe('secret box', () => {
  it('round-trips a key and never stores it in clear', () => {
    const sealed = sealSecret('AIzaSy-very-secret-key', ENV);
    expect(sealed).not.toContain('very-secret');
    expect(sealed.startsWith('v1:')).toBe(true);
    expect(openSecret(sealed, ENV)).toBe('AIzaSy-very-secret-key');
  });

  it('uses a fresh IV, so the same key seals differently each time', () => {
    expect(sealSecret('same', ENV)).not.toBe(sealSecret('same', ENV));
  });

  it('prefers APP_SECRETS_KEY over JWT_SECRET', () => {
    const withOwnKey = { ...ENV, APP_SECRETS_KEY: 'another-secret-that-is-long-enough-456' };
    const sealed = sealSecret('value', withOwnKey);
    expect(openSecret(sealed, withOwnKey)).toBe('value');
    expect(openSecret(sealed, ENV)).toBeNull();
  });

  it('returns null after the server secret changes or the value is altered', () => {
    const sealed = sealSecret('value', ENV);
    expect(openSecret(sealed, { JWT_SECRET: 'a-different-secret-also-long-enough' })).toBeNull();
    const [version, iv, tag, data] = sealed.split(':');
    const flipped = `${data!.startsWith('A') ? 'B' : 'A'}${data!.slice(1)}`;
    expect(openSecret([version, iv, tag, flipped].join(':'), ENV)).toBeNull();
    expect(openSecret('not-a-sealed-value', ENV)).toBeNull();
  });

  it('refuses to seal without a long enough server secret', () => {
    expect(() => sealSecret('value', { JWT_SECRET: 'short' })).toThrow(/at least 32/);
  });

  it('shows only the last 4 characters', () => {
    expect(lastFour('  sk-abcdef1234  ')).toBe('1234');
  });
});
