import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

// Offline queue idempotency (ADR-004): a retried POST with the same
// clientMutationId never creates a second set, the device time becomes
// completedAt, and a set logged before the session was finished still lands.

vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { POST as postSet } from '@/app/api/sessions/[id]/sets/route';

function post(sessionId: string, body: unknown) {
  return postSet(
    new Request('http://test.local/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: sessionId }) },
  );
}

async function seed(email = 'sync@test.dev') {
  const user = await db.user.create({ data: { email, passwordHash: 'x' } });
  const bench = await db.exercise.create({
    data: { userId: user.id, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  const session = await db.session.create({
    data: { userId: user.id, startedAt: new Date(Date.now() - 60 * 60_000) },
  });
  return { user, bench, session };
}

const setBody = (exerciseId: string, extra: Record<string, unknown> = {}) => ({
  exerciseId,
  setNumber: 1,
  weight: 80,
  reps: 8,
  rir: 2,
  clientMutationId: 'loc_0123456789abcdef',
  ...extra,
});

beforeEach(() => mockUserId.mockReset());

describe('POST /api/sessions/[id]/sets idempotency', () => {
  it('returns the stored set on a retry instead of creating a duplicate', async () => {
    const { user, bench, session } = await seed();
    mockUserId.mockResolvedValue(user.id);

    const first = await post(session.id, setBody(bench.id));
    const retry = await post(session.id, setBody(bench.id));

    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect((await retry.json()).id).toBe((await first.json()).id);
    await expect(db.set.count({ where: { sessionId: session.id } })).resolves.toBe(1);
  });

  it('survives two concurrent posts of the same set (two tabs)', async () => {
    const { user, bench, session } = await seed();
    mockUserId.mockResolvedValue(user.id);

    const [a, b] = await Promise.all([
      post(session.id, setBody(bench.id)),
      post(session.id, setBody(bench.id)),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 201]);
    await expect(db.set.count({ where: { sessionId: session.id } })).resolves.toBe(1);
  });

  it('keeps distinct sets with distinct keys', async () => {
    const { user, bench, session } = await seed();
    mockUserId.mockResolvedValue(user.id);

    await post(session.id, setBody(bench.id));
    await post(
      session.id,
      setBody(bench.id, { setNumber: 2, clientMutationId: 'loc_fedcba9876543210' }),
    );

    await expect(db.set.count({ where: { sessionId: session.id } })).resolves.toBe(2);
  });

  it('stores when the set was performed, not when it arrived', async () => {
    const { user, bench, session } = await seed();
    mockUserId.mockResolvedValue(user.id);
    const performedAt = Date.now() - 20 * 60_000;

    const res = await post(session.id, setBody(bench.id, { performedAt }));
    const saved = await db.set.findUniqueOrThrow({ where: { id: (await res.json()).id } });

    expect(saved.completedAt.getTime()).toBe(performedAt);
    expect(saved.receivedAt.getTime()).toBeGreaterThan(performedAt);
  });

  it('accepts a set logged before the session was finished elsewhere, refuses later ones', async () => {
    const { user, bench, session } = await seed();
    mockUserId.mockResolvedValue(user.id);
    const finishedAt = new Date(Date.now() - 5 * 60_000);
    await db.session.update({ where: { id: session.id }, data: { finishedAt } });

    const before = await post(
      session.id,
      setBody(bench.id, { performedAt: finishedAt.getTime() - 60_000 }),
    );
    expect(before.status).toBe(201);

    const after = await post(
      session.id,
      setBody(bench.id, { clientMutationId: 'loc_after0000000001', performedAt: Date.now() }),
    );
    expect(after.status).toBe(400);

    const unkeyed = await post(session.id, {
      exerciseId: bench.id,
      setNumber: 3,
      weight: 80,
      reps: 8,
    });
    expect(unkeyed.status).toBe(400);
  });

  it('never replays a key into another user session', async () => {
    const owner = await seed('owner@test.dev');
    const intruder = await seed('intruder@test.dev');
    mockUserId.mockResolvedValue(owner.user.id);
    await post(owner.session.id, setBody(owner.bench.id));

    mockUserId.mockResolvedValue(intruder.user.id);
    const res = await post(owner.session.id, setBody(intruder.bench.id));
    expect(res.status).toBe(404);
  });
});
