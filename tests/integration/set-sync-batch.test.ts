import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

// Batched set push with per-item results and delete tombstones (ADR-004):
// one refused item never sinks the batch, a delete works whether or not the
// device learned the server id, and a create replayed after its delete is
// refused instead of resurrecting the set.

vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { POST as postBatch } from '@/app/api/sessions/[id]/sets/batch/route';
import { POST as postSet } from '@/app/api/sessions/[id]/sets/route';
import { DELETE as deleteSet } from '@/app/api/sets/[id]/route';

function request(body: unknown) {
  return new Request('http://test.local/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function batch(sessionId: string, items: unknown[]) {
  const res = await postBatch(request({ items }), { params: Promise.resolve({ id: sessionId }) });
  return { status: res.status, body: (await res.json()) as { results?: ItemResult[] } };
}

interface ItemResult {
  key: string;
  status: number;
  set?: { id: string; weight: number };
  error?: string;
}

async function seed(email = 'batch@test.dev') {
  const user = await db.user.create({ data: { email, passwordHash: 'x' } });
  const bench = await db.exercise.create({
    data: { userId: user.id, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  const session = await db.session.create({
    data: { userId: user.id, startedAt: new Date(Date.now() - 60 * 60_000) },
  });
  return { user, bench, session };
}

const create = (key: string, exerciseId: string, extra: Record<string, unknown> = {}) => ({
  op: 'create',
  key,
  set: {
    exerciseId,
    setNumber: 1,
    weight: 80,
    reps: 8,
    rir: 2,
    clientMutationId: key,
    ...extra,
  },
});

beforeEach(() => mockUserId.mockReset());

describe('POST /api/sessions/[id]/sets/batch', () => {
  it('applies creates, updates and deletes in order with one result per item', async () => {
    const { user, bench, session } = await seed();
    mockUserId.mockResolvedValue(user.id);

    const first = await batch(session.id, [
      create('loc_aaaaaaaaaaaaaaaa', bench.id),
      create('loc_bbbbbbbbbbbbbbbb', bench.id, { setNumber: 2 }),
      create('loc_cccccccccccccccc', 'not-an-exercise', { setNumber: 3 }),
    ]);
    expect(first.status).toBe(200);
    expect(first.body.results!.map((r) => [r.key, r.status])).toEqual([
      ['loc_aaaaaaaaaaaaaaaa', 201],
      ['loc_bbbbbbbbbbbbbbbb', 201],
      ['loc_cccccccccccccccc', 400],
    ]);
    const [a, b] = first.body.results!;

    const second = await batch(session.id, [
      // Replay of a stored set: same row, no duplicate.
      create('loc_aaaaaaaaaaaaaaaa', bench.id),
      { op: 'update', key: 'loc_aaaaaaaaaaaaaaaa', setId: a!.set!.id, patch: { weight: 85, reps: 8, rir: 1 } },
      { op: 'delete', key: 'loc_bbbbbbbbbbbbbbbb', setId: b!.set!.id, clientMutationId: 'loc_bbbbbbbbbbbbbbbb' },
    ]);
    expect(second.body.results!.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(second.body.results![0]!.set!.id).toBe(a!.set!.id);
    expect(second.body.results![1]!.set!.weight).toBe(85);

    const stored = await db.set.findMany({ where: { sessionId: session.id } });
    expect(stored.map((s) => [s.clientMutationId, s.weight])).toEqual([['loc_aaaaaaaaaaaaaaaa', 85]]);
  });

  it('tombstones a deleted set so a late create cannot bring it back', async () => {
    const { user, bench, session } = await seed();
    mockUserId.mockResolvedValue(user.id);

    // Created, then deleted by the single-set route.
    const created = await postSet(request(create('loc_dddddddddddddddd', bench.id).set), {
      params: Promise.resolve({ id: session.id }),
    });
    const row = (await created.json()) as { id: string };
    expect((await deleteSet(new Request('http://test.local'), { params: Promise.resolve({ id: row.id }) })).status).toBe(200);

    // The lost-response retry of the original create arrives late.
    const replay = await batch(session.id, [create('loc_dddddddddddddddd', bench.id)]);
    expect(replay.body.results![0]!.status).toBe(410);
    await expect(db.set.count({ where: { sessionId: session.id } })).resolves.toBe(0);
  });

  it('deletes by device key when the server id never reached the device', async () => {
    const { user, bench, session } = await seed();
    mockUserId.mockResolvedValue(user.id);

    // The create landed but its response was lost; then the lifter deleted it.
    await batch(session.id, [create('loc_eeeeeeeeeeeeeeee', bench.id)]);
    const removed = await batch(session.id, [
      { op: 'delete', key: 'loc_eeeeeeeeeeeeeeee', clientMutationId: 'loc_eeeeeeeeeeeeeeee' },
    ]);
    expect(removed.body.results![0]!.status).toBe(200);
    await expect(db.set.count({ where: { sessionId: session.id } })).resolves.toBe(0);

    // The delete overtook a create still in flight: the create is refused.
    const early = await batch(session.id, [
      { op: 'delete', key: 'loc_ffffffffffffffff', clientMutationId: 'loc_ffffffffffffffff' },
      create('loc_ffffffffffffffff', bench.id),
    ]);
    expect(early.body.results!.map((r) => r.status)).toEqual([200, 410]);
    await expect(db.set.count({ where: { sessionId: session.id } })).resolves.toBe(0);

    // Deleting again is a no-op success.
    const again = await batch(session.id, [
      { op: 'delete', key: 'loc_eeeeeeeeeeeeeeee', clientMutationId: 'loc_eeeeeeeeeeeeeeee' },
    ]);
    expect(again.body.results![0]!.status).toBe(200);
  });

  it("never touches another user's session or sets", async () => {
    const owner = await seed('owner@test.dev');
    const intruder = await seed('intruder@test.dev');
    mockUserId.mockResolvedValue(owner.user.id);
    const created = await batch(owner.session.id, [create('loc_gggggggggggggggg', owner.bench.id)]);
    const setId = created.body.results![0]!.set!.id;

    mockUserId.mockResolvedValue(intruder.user.id);
    const foreignSession = await batch(owner.session.id, [
      create('loc_hhhhhhhhhhhhhhhh', intruder.bench.id),
    ]);
    expect(foreignSession.status).toBe(404);

    // Through their own session, the intruder cannot reach the owner's set.
    const foreignSet = await batch(intruder.session.id, [
      { op: 'update', key: 'k1', setId, patch: { weight: 1, reps: 1, rir: null } },
      { op: 'delete', key: 'k2', setId },
    ]);
    expect(foreignSet.body.results!.map((r) => r.status)).toEqual([404, 200]);
    const kept = await db.set.findUniqueOrThrow({ where: { id: setId } });
    expect(kept.weight).toBe(80);
  });

  it('rejects an empty or oversized batch as a whole', async () => {
    const { user, bench, session } = await seed();
    mockUserId.mockResolvedValue(user.id);
    expect((await batch(session.id, [])).status).toBe(400);
    const tooMany = Array.from({ length: 101 }, (_, i) =>
      create(`loc_${String(i).padStart(16, '0')}`, bench.id),
    );
    expect((await batch(session.id, tooMany)).status).toBe(400);
  });
});
