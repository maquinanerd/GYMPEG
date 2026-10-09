import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { DELOAD_DURATION_DAYS } from '@/lib/deload';

// Auth is read through getCurrentUserId (via requireApiUserId in @/lib/api).
// Mock it so we can act as a given user without real cookies/JWTs.
vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { POST, DELETE } from '@/app/api/deload/route';

function actAs(userId: string | null) {
  mockUserId.mockResolvedValue(userId);
}

function postReq(body: unknown = {}): Request {
  return new Request('http://test.local/api/deload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function makeUser(email: string) {
  return db.user.create({ data: { email, passwordHash: 'x' } });
}

beforeEach(() => {
  mockUserId.mockReset();
});

describe('POST /api/deload', () => {
  it('starts a deload week ending about 7 days from now for the caller', async () => {
    const user = await makeUser('deload-start@test.dev');
    actAs(user.id);

    const before = Date.now();
    const res = await POST(postReq());
    const after = Date.now();
    expect(res.status).toBe(201);

    const updated = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.deloadUntil).not.toBeNull();
    const expectedMs = DELOAD_DURATION_DAYS * 24 * 60 * 60 * 1000;
    expect(updated.deloadUntil!.getTime()).toBeGreaterThanOrEqual(before + expectedMs);
    expect(updated.deloadUntil!.getTime()).toBeLessThanOrEqual(after + expectedMs);

    const body = (await res.json()) as { deloadUntil: string };
    expect(new Date(body.deloadUntil).getTime()).toBe(updated.deloadUntil!.getTime());
  });

  it("only touches the caller's own row, never another user's", async () => {
    const owner = await makeUser('deload-owner@test.dev');
    const stranger = await makeUser('deload-stranger@test.dev');
    actAs(owner.id);

    const res = await POST(postReq());
    expect(res.status).toBe(201);

    const untouched = await db.user.findUniqueOrThrow({ where: { id: stranger.id } });
    expect(untouched.deloadUntil).toBeNull();
  });

  it('rejects a body with unexpected fields (no client-chosen duration)', async () => {
    const user = await makeUser('deload-strict@test.dev');
    actAs(user.id);

    const res = await POST(postReq({ days: 90 }));
    expect(res.status).toBe(400);
    const unchanged = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(unchanged.deloadUntil).toBeNull();
  });

  it('returns 401 when unauthenticated and persists nothing', async () => {
    const user = await makeUser('deload-anon@test.dev');
    actAs(null);

    const res = await POST(postReq());
    expect(res.status).toBe(401);
    const unchanged = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(unchanged.deloadUntil).toBeNull();
  });
});

describe('DELETE /api/deload', () => {
  it('clears the active deload for the caller only', async () => {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const owner = await makeUser('deload-end@test.dev');
    const stranger = await makeUser('deload-end-other@test.dev');
    await db.user.update({ where: { id: owner.id }, data: { deloadUntil: future } });
    await db.user.update({ where: { id: stranger.id }, data: { deloadUntil: future } });
    actAs(owner.id);

    const res = await DELETE();
    expect(res.status).toBe(200);

    const cleared = await db.user.findUniqueOrThrow({ where: { id: owner.id } });
    expect(cleared.deloadUntil).toBeNull();
    // The other user's planned deload is untouched.
    const other = await db.user.findUniqueOrThrow({ where: { id: stranger.id } });
    expect(other.deloadUntil?.getTime()).toBe(future.getTime());
  });

  it('is idempotent: deleting with no active deload still succeeds', async () => {
    const user = await makeUser('deload-noop@test.dev');
    actAs(user.id);

    const res = await DELETE();
    expect(res.status).toBe(200);
    expect((await res.json()).deloadUntil).toBeNull();
  });

  it('returns 401 when unauthenticated', async () => {
    actAs(null);
    const res = await DELETE();
    expect(res.status).toBe(401);
  });
});

// Each deload taken is kept (epic 2.5): how it was started, why, and when it
// ended; the training block since the last one feeds the recommendation.
describe('deload history', () => {
  it('records the period with its trigger and reasons, closing it on restart and on end', async () => {
    const user = await makeUser('deload-history@test.dev');
    actAs(user.id);

    expect(
      (await POST(postReq({ trigger: 'RECOMMENDED', reasons: ['stalled-lifts', 'long-block'] })))
        .status,
    ).toBe(201);
    expect((await POST(postReq())).status).toBe(201);

    const periods = await db.deloadPeriod.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: 'asc' },
    });
    expect(periods).toHaveLength(2);
    expect(periods[0]).toMatchObject({
      trigger: 'RECOMMENDED',
      reasons: ['stalled-lifts', 'long-block'],
    });
    // The restart closed the first one; a bare start is manual.
    expect(periods[0]!.endedAt).not.toBeNull();
    expect(periods[1]).toMatchObject({ trigger: 'MANUAL', reasons: [], endedAt: null });

    expect((await DELETE()).status).toBe(200);
    const ended = await db.deloadPeriod.findUniqueOrThrow({ where: { id: periods[1]!.id } });
    expect(ended.endedAt).not.toBeNull();
  });

  it('rejects an unknown reason kind', async () => {
    const user = await makeUser('deload-bad-reason@test.dev');
    actAs(user.id);
    expect((await POST(postReq({ reasons: ['bored'] }))).status).toBe(400);
    expect(await db.deloadPeriod.count({ where: { userId: user.id } })).toBe(0);
  });

  it('measures the block from the latest deload, taken or planned in the cycle', async () => {
    const { loadTrainingBlock } = await import('@/lib/deload-history');
    const user = await makeUser('deload-block@test.dev');
    const program = await db.program.create({
      data: { userId: user.id, name: 'Block', phase: 'Base', cycleWeeks: 4, cycleDeloadWeek: 4 },
    });
    const now = new Date();
    const weeksAgo = (weeks: number) => new Date(now.getTime() - weeks * 7 * 86_400_000);
    // Ten weeks of training, the planned deload week of the cycle 3 weeks ago.
    for (let week = 10; week >= 1; week -= 1) {
      await db.session.create({
        data: {
          userId: user.id,
          programId: program.id,
          startedAt: weeksAgo(week),
          finishedAt: weeksAgo(week),
          cycleWeek: week === 3 ? 4 : 1,
        },
      });
    }

    const block = await loadTrainingBlock(user.id, now, 'UTC');
    expect(block).toEqual({ weeks: 3, trainedWeeks: 3 });

    // A deload taken one week ago is more recent.
    await db.deloadPeriod.create({
      data: { userId: user.id, trigger: 'MANUAL', startedAt: weeksAgo(1), endsAt: now },
    });
    expect(await loadTrainingBlock(user.id, now, 'UTC')).toEqual({ weeks: 1, trainedWeeks: 1 });
  });
});
