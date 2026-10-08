import { afterEach, describe, expect, it, vi } from 'vitest';

// Lives in lib/ rather than beside the route: vitest.config.ts only includes
// lib/** and components/** as unit tests.

const queryRaw = vi.fn();

vi.mock('@/lib/db', () => ({
  db: { $queryRaw: (...args: unknown[]) => queryRaw(...args) },
}));

const { GET } = await import('@/app/api/health/route');

describe('GET /api/health', () => {
  afterEach(() => {
    queryRaw.mockReset();
    vi.useRealTimers();
  });

  it('returns 200 when the database answers', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('returns 503 without error details when the database fails', async () => {
    queryRaw.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ status: 'unavailable' });
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
  });

  it('returns 503 when the database hangs past the timeout', async () => {
    vi.useFakeTimers();
    queryRaw.mockReturnValue(new Promise(() => {}));

    const pending = GET();
    await vi.advanceTimersByTimeAsync(3000);
    const response = await pending;

    expect(response.status).toBe(503);
  });
});
