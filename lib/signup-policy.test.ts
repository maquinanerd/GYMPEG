import { describe, expect, it } from 'vitest';
import { allowedSignupEmails, isSignupAllowed, resolveSignupMode } from './signup-policy';

describe('resolveSignupMode', () => {
  it('defaults to open outside production and to allowlist in production', () => {
    expect(resolveSignupMode({ NODE_ENV: 'development' })).toBe('open');
    expect(resolveSignupMode({ NODE_ENV: 'test' })).toBe('open');
    expect(resolveSignupMode({ NODE_ENV: 'production' })).toBe('allowlist');
  });

  it('honors an explicit mode, case-insensitive, and ignores unknown values', () => {
    expect(resolveSignupMode({ NODE_ENV: 'production', SIGNUP_MODE: ' OPEN ' })).toBe('open');
    expect(resolveSignupMode({ NODE_ENV: 'development', SIGNUP_MODE: 'closed' })).toBe('closed');
    expect(resolveSignupMode({ NODE_ENV: 'production', SIGNUP_MODE: 'invite' })).toBe('allowlist');
  });
});

describe('allowedSignupEmails', () => {
  it('splits on commas, semicolons and whitespace and normalizes case', () => {
    expect(
      allowedSignupEmails({
        SIGNUP_ALLOWED_EMAILS: ' Ana@Example.com, bia@example.com;\ncid@x.io ,,',
      }),
    ).toEqual(new Set(['ana@example.com', 'bia@example.com', 'cid@x.io']));
    expect(allowedSignupEmails({})).toEqual(new Set());
  });
});

describe('isSignupAllowed', () => {
  it('lets anyone in when open', () => {
    expect(isSignupAllowed('x@y.z', { SIGNUP_MODE: 'open' })).toBe(true);
  });

  it('refuses everyone when closed, even allowlisted emails', () => {
    expect(
      isSignupAllowed('ana@example.com', {
        SIGNUP_MODE: 'closed',
        SIGNUP_ALLOWED_EMAILS: 'ana@example.com',
      }),
    ).toBe(false);
  });

  it('only admits listed emails in allowlist mode, ignoring case and spaces', () => {
    const env = { NODE_ENV: 'production', SIGNUP_ALLOWED_EMAILS: 'ana@example.com' };
    expect(isSignupAllowed('  ANA@example.com ', env)).toBe(true);
    expect(isSignupAllowed('eve@example.com', env)).toBe(false);
  });

  it('is closed in production when no allowlist is configured', () => {
    expect(isSignupAllowed('ana@example.com', { NODE_ENV: 'production' })).toBe(false);
  });
});
