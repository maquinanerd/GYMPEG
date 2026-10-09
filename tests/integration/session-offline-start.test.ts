import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

// Starting and finishing a session from the offline outbox (ADR-004): the
// device picks the session id (UUIDv7) and the times, the server makes the
// start and the finish idempotent and bounds the device clock.

vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { POST as startSession } from '@/app/api/sessions/route';
import { PUT as updateSession } from '@/app/api/sessions/[id]/route';
import { POST as postSet } from '@/app/api/sessions/[id]/sets/route';

const DEVICE_ID = '0199c2f4-5a3b-7c4d-8e5f-6a7b8c9d0e1f';
const OTHER_DEVICE_ID = '0199c2f4-5a3b-7c4d-8e5f-6a7b8c9d0e20';

function jsonReq(method: string, body: unknown): Request {
  return new Request('http://test.local/api', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const start = (body: unknown) => startSession(jsonReq('POST', body));
const update = (id: string, body: unknown) =>
  updateSession(jsonReq('PUT', body), { params: Promise.resolve({ id }) });

async function seed(email = 'offline@test.dev') {
  const user = await db.user.create({ data: { email, passwordHash: 'x' } });
  const program = await db.program.create({
    data: { userId: user.id, name: 'Block', phase: 'Base', isActive: true },
  });
  const workout = await db.workout.create({
    data: { programId: program.id, name: 'Push', order: 1 },
  });
  const bench = await db.exercise.create({
    data: { userId: user.id, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  return { user, workout, bench };
}

beforeEach(() => mockUserId.mockReset());

describe('POST /api/sessions with a device id', () => {
  it('creates the session under the device id and the device start time', async () => {
    const { user, workout } = await seed();
    mockUserId.mockResolvedValue(user.id);
    const startedAt = Date.now() - 2 * 60 * 60_000;

    const res = await start({ workoutId: workout.id, id: DEVICE_ID, startedAt });

    expect(res.status).toBe(201);
    const stored = await db.session.findUniqueOrThrow({ where: { id: DEVICE_ID } });
    expect(stored).toMatchObject({ userId: user.id, workoutId: workout.id, finishedAt: null });
    expect(stored.startedAt.getTime()).toBe(startedAt);
  });

  it('answers a replay with the stored session instead of creating another', async () => {
    const { user, workout } = await seed();
    mockUserId.mockResolvedValue(user.id);

    const first = await start({ workoutId: workout.id, id: DEVICE_ID });
    const replay = await start({ workoutId: workout.id, id: DEVICE_ID });

    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect((await replay.json()).id).toBe(DEVICE_ID);
    await expect(db.session.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it('survives two concurrent starts with the same id', async () => {
    const { user, workout } = await seed();
    mockUserId.mockResolvedValue(user.id);

    const [a, b] = await Promise.all([
      start({ workoutId: workout.id, id: DEVICE_ID }),
      start({ workoutId: workout.id, id: DEVICE_ID }),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 201]);
    await expect(db.session.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it('caps a start time from a clock ahead of the server', async () => {
    const { user, workout } = await seed();
    mockUserId.mockResolvedValue(user.id);
    const before = Date.now();

    await start({ workoutId: workout.id, id: DEVICE_ID, startedAt: before + 60 * 60_000 });

    const stored = await db.session.findUniqueOrThrow({ where: { id: DEVICE_ID } });
    expect(stored.startedAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(stored.startedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('creates an offline start even with another unfinished session on the workout', async () => {
    const { user, workout } = await seed();
    mockUserId.mockResolvedValue(user.id);
    await start({ workoutId: workout.id, id: OTHER_DEVICE_ID });

    const res = await start({ workoutId: workout.id, id: DEVICE_ID });

    // Its queued sets already point to DEVICE_ID.
    expect(res.status).toBe(201);
    expect((await res.json()).id).toBe(DEVICE_ID);
  });

  it('resumes the unfinished session of the workout on a live start', async () => {
    const { user, workout } = await seed();
    mockUserId.mockResolvedValue(user.id);
    await start({ workoutId: workout.id, id: OTHER_DEVICE_ID });

    const res = await start({ workoutId: workout.id, id: DEVICE_ID, resumeOpen: true });

    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(OTHER_DEVICE_ID);
    await expect(db.session.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it('starts without the gym when the gym was deleted while the device was offline', async () => {
    const { user, workout } = await seed();
    mockUserId.mockResolvedValue(user.id);

    const offline = await start({ workoutId: workout.id, id: DEVICE_ID, gymId: 'deleted-gym' });
    const legacy = await start({ workoutId: workout.id, gymId: 'deleted-gym' });

    expect(offline.status).toBe(201);
    expect((await offline.json()).gymId).toBeNull();
    // Older clients still get the validation error.
    expect(legacy.status).toBe(400);
  });

  it("refuses an id that belongs to another account's session", async () => {
    const owner = await seed('owner@test.dev');
    const intruder = await seed('intruder@test.dev');
    mockUserId.mockResolvedValue(owner.user.id);
    await start({ workoutId: owner.workout.id, id: DEVICE_ID });

    mockUserId.mockResolvedValue(intruder.user.id);
    const res = await start({ workoutId: intruder.workout.id, id: DEVICE_ID });

    expect(res.status).toBe(409);
    expect((await db.session.findUniqueOrThrow({ where: { id: DEVICE_ID } })).userId).toBe(
      owner.user.id,
    );
  });

  it('rejects an id that is not a UUIDv7', async () => {
    const { user, workout } = await seed();
    mockUserId.mockResolvedValue(user.id);

    const res = await start({ workoutId: workout.id, id: 'my-own-session-id' });

    expect(res.status).toBe(400);
  });

  it('accepts the sets queued against the device id once the start lands', async () => {
    const { user, workout, bench } = await seed();
    mockUserId.mockResolvedValue(user.id);
    const startedAt = Date.now() - 30 * 60_000;
    await start({ workoutId: workout.id, id: DEVICE_ID, startedAt });

    const res = await postSet(
      jsonReq('POST', {
        exerciseId: bench.id,
        setNumber: 1,
        weight: 80,
        reps: 8,
        clientMutationId: 'loc_0123456789abcdef',
        performedAt: startedAt + 5 * 60_000,
      }),
      { params: Promise.resolve({ id: DEVICE_ID }) },
    );

    expect(res.status).toBe(201);
  });
});

describe('PUT /api/sessions/[id] finish from the device', () => {
  it('stores the device finish time and keeps it on a replay', async () => {
    const { user, workout } = await seed();
    mockUserId.mockResolvedValue(user.id);
    const startedAt = Date.now() - 90 * 60_000;
    const finishedAt = Date.now() - 20 * 60_000;
    await start({ workoutId: workout.id, id: DEVICE_ID, startedAt });

    const first = await update(DEVICE_ID, { finish: true, finishedAt, notes: 'solid' });
    const replay = await update(DEVICE_ID, { finish: true, finishedAt: Date.now() });

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    const stored = await db.session.findUniqueOrThrow({ where: { id: DEVICE_ID } });
    expect(stored.finishedAt?.getTime()).toBe(finishedAt);
    expect(stored.notes).toBe('solid');
  });

  it('never finishes before the start or in the future', async () => {
    const { user, workout } = await seed();
    mockUserId.mockResolvedValue(user.id);
    const startedAt = Date.now() - 90 * 60_000;
    await start({ workoutId: workout.id, id: DEVICE_ID, startedAt });
    await start({ workoutId: workout.id, id: OTHER_DEVICE_ID, startedAt });

    await update(DEVICE_ID, { finish: true, finishedAt: startedAt - 60_000 });
    await update(OTHER_DEVICE_ID, { finish: true, finishedAt: Date.now() + 60 * 60_000 });

    const early = await db.session.findUniqueOrThrow({ where: { id: DEVICE_ID } });
    const late = await db.session.findUniqueOrThrow({ where: { id: OTHER_DEVICE_ID } });
    expect(early.finishedAt?.getTime()).toBe(startedAt);
    expect(late.finishedAt!.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
