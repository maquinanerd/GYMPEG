import { describe, it, expect } from 'vitest';
import { registerSchema } from './auth';

describe('registerSchema', () => {
  it('accepts a valid registration', () => {
    const r = registerSchema.safeParse({
      email: 'a@b.com',
      password: 'longenough',
      displayName: 'Al',
    });
    expect(r.success).toBe(true);
  });

  it('rejects a password shorter than 8 chars', () => {
    expect(registerSchema.safeParse({ email: 'a@b.com', password: 'short' }).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(registerSchema.safeParse({ email: 'nope', password: 'longenough' }).success).toBe(false);
  });

  it('makes displayName optional', () => {
    expect(registerSchema.safeParse({ email: 'a@b.com', password: 'longenough' }).success).toBe(
      true,
    );
  });
  it('keeps a valid device time zone and drops an unknown one', () => {
    const base = { email: 'a@b.com', password: 'longenough' };
    expect(registerSchema.parse({ ...base, timezone: 'Europe/Lisbon' }).timezone).toBe(
      'Europe/Lisbon',
    );
    expect(registerSchema.parse({ ...base, timezone: 'Nowhere/Land' }).timezone).toBeUndefined();
  });

  it('refuses passwords bcrypt would truncate (over 72 bytes)', () => {
    const base = { email: 'a@b.com' };
    expect(registerSchema.safeParse({ ...base, password: 'a'.repeat(72) }).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, password: 'é'.repeat(37) }).success).toBe(false);
  });
});
