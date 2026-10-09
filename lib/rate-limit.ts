// ============================================================
// Fixed-window rate limiter
// ============================================================
// Protection for auth, import and AI endpoints. Two stores:
// - memory (default): per process, enough for a single instance;
// - postgres (RATE_LIMIT_STORE=postgres, G3): one counter per key shared by
//   every instance, so scaling out does not multiply the allowance. Keys are
//   stored as a SHA-256 (some contain an e-mail address).

import { createHash } from 'node:crypto';
import { db } from '@/lib/db';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

// Allows `limit` calls per `windowMs` for a key, in this process. `now` is
// injectable for deterministic tests.
export function rateLimitInMemory(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  if (bucket.count < limit) {
    bucket.count += 1;
    return { ok: true, retryAfterSec: 0 };
  }
  return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
}

// The same window in Postgres, in one atomic statement: a new or expired
// bucket restarts at 1, a live one counts up.
async function rateLimitInPostgres(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const keyHash = createHash('sha256').update(key).digest('hex');
  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimitBucket" ("keyHash", "count", "resetAt")
    VALUES (${keyHash}, 1, now() + ${windowMs} * interval '1 millisecond')
    ON CONFLICT ("keyHash") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."resetAt" <= now() THEN 1
                     ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= now()
                       THEN now() + ${windowMs} * interval '1 millisecond'
                       ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count", "resetAt"`;
  const row = rows[0]!;
  // Expired buckets are swept now and then, not on every call.
  if (Math.random() < 0.01) {
    void db.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "resetAt" < now() - interval '1 hour'`.catch(
      () => undefined,
    );
  }
  if (row.count <= limit) return { ok: true, retryAfterSec: 0 };
  return {
    ok: false,
    retryAfterSec: Math.max(1, Math.ceil((row.resetAt.getTime() - Date.now()) / 1000)),
  };
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  return process.env.RATE_LIMIT_STORE?.trim().toLowerCase() === 'postgres'
    ? rateLimitInPostgres(key, limit, windowMs)
    : rateLimitInMemory(key, limit, windowMs);
}

// Best-effort client IP from common proxy headers (the app runs behind a
// reverse proxy in production).
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || 'unknown';
  return req.headers.get('x-real-ip') ?? 'unknown';
}

// Test helper: clears the in-memory buckets.
export function resetRateLimits(): void {
  buckets.clear();
}
