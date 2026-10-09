import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';

// Shared rate limit (G3): with RATE_LIMIT_STORE=postgres every instance counts
// in the same row, keyed by a hash of the limiter key.

beforeEach(() => vi.stubEnv('RATE_LIMIT_STORE', 'postgres'));
afterEach(() => vi.unstubAllEnvs());

describe('rateLimit in Postgres', () => {
  it('allows the limit, then blocks with a retry delay, per key', async () => {
    const key = `login:${randomUUID()}`;
    expect((await rateLimit(key, 2, 60_000)).ok).toBe(true);
    expect((await rateLimit(key, 2, 60_000)).ok).toBe(true);
    const blocked = await rateLimit(key, 2, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect((await rateLimit(`login:${randomUUID()}`, 2, 60_000)).ok).toBe(true);
  });

  it('counts concurrent requests once each (no lost updates)', async () => {
    const key = `burst:${randomUUID()}`;
    const results = await Promise.all(Array.from({ length: 10 }, () => rateLimit(key, 4, 60_000)));
    expect(results.filter((result) => result.ok)).toHaveLength(4);
  });

  it('restarts an expired window and never stores the plain key', async () => {
    const email = `someone-${randomUUID()}@test.dev`;
    const key = `password-reset-email:${email}`;
    await rateLimit(key, 1, 60_000);
    expect((await rateLimit(key, 1, 60_000)).ok).toBe(false);

    const rows = await db.rateLimitBucket.findMany();
    expect(JSON.stringify(rows)).not.toContain(email);
    // Expire it.
    await db.$executeRaw`UPDATE "RateLimitBucket" SET "resetAt" = now() - interval '1 second'`;
    expect((await rateLimit(key, 1, 60_000)).ok).toBe(true);
  });
});
