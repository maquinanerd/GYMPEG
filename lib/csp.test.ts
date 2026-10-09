import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy, generateNonce } from './csp';

function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split('; ').map((directive) => {
      const [name, ...values] = directive.split(' ');
      return [name!, values];
    }),
  );
}

describe('content security policy', () => {
  it('draws a fresh base64 nonce of 128 bits each time', () => {
    const nonces = new Set(Array.from({ length: 50 }, generateNonce));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) {
      expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    }
  });

  it('allows scripts only by nonce, with no inline or eval escape hatch', () => {
    const policy = directives(buildContentSecurityPolicy('abc123'));
    expect(policy.get('script-src')).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
    expect(policy.get('default-src')).toEqual(["'self'"]);
    expect(policy.get('object-src')).toEqual(["'none'"]);
    expect(policy.get('frame-ancestors')).toEqual(["'none'"]);
    expect(policy.get('base-uri')).toEqual(["'self'"]);
    expect(policy.get('form-action')).toEqual(["'self'"]);
    expect(policy.get('connect-src')).toEqual(["'self'"]);
    expect(policy.get('script-src')).not.toContain("'unsafe-inline'");
  });

  it("adds 'unsafe-eval' only in development", () => {
    expect(buildContentSecurityPolicy('n')).not.toContain('unsafe-eval');
    expect(directives(buildContentSecurityPolicy('n', { dev: true })).get('script-src')).toContain(
      "'unsafe-eval'",
    );
  });
});
