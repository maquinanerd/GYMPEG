import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

// Records a finished session beat (epic 2.2): stored at the finish with the
// previous best, once, on effective loads.

vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { PUT as updateSession } from '@/app/api/sessions/[id]/route';
import { recentPersonalRecords } from '@/lib/personal-records';

const finish = (id: string) =>
  updateSession(
    new Request('http://test.local/api', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ finish: true }),
    }),
    { params: Promise.resolve({ id }) },
  );

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

async function seed() {
  const user = await db.user.create({
    data: { email: 'records@test.dev', passwordHash: 'x', bodyweight: 80, timezone: 'UTC' },
  });
  const bench = await db.exercise.create({
    data: { userId: user.id, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  const dip = await db.exercise.create({
    data: {
      userId: user.id,
      name: 'Dip',
      muscleGroup: 'TRICEPS',
      category: 'COMPOUND',
      usesBodyweight: true,
    },
  });
  const before = await db.session.create({
    data: { userId: user.id, startedAt: daysAgo(8), finishedAt: daysAgo(8) },
  });
  await db.set.createMany({
    data: [
      { sessionId: before.id, exerciseId: bench.id, setNumber: 1, weight: 100, reps: 5 },
      {
        sessionId: before.id,
        exerciseId: bench.id,
        setNumber: 2,
        weight: 60,
        reps: 12,
        isWarmup: true,
      },
      { sessionId: before.id, exerciseId: dip.id, setNumber: 1, weight: 10, reps: 8 },
    ],
  });
  const today = await db.session.create({ data: { userId: user.id, startedAt: daysAgo(0) } });
  await db.set.createMany({
    data: [
      { sessionId: today.id, exerciseId: bench.id, setNumber: 1, weight: 105, reps: 5 },
      // Bodyweight 80 + 12.5 added = 92.5 effective, beats 90.
      { sessionId: today.id, exerciseId: dip.id, setNumber: 1, weight: 12.5, reps: 8 },
    ],
  });
  return { user, bench, dip, today };
}

beforeEach(() => mockUserId.mockReset());

describe('personal records at session finish', () => {
  it('stores what the session beat, with the previous best, once', async () => {
    const { user, bench, dip, today } = await seed();
    mockUserId.mockResolvedValue(user.id);

    expect((await finish(today.id)).status).toBe(200);
    // A replayed finish (offline outbox) changes nothing.
    expect((await finish(today.id)).status).toBe(200);

    const records = await db.personalRecord.findMany({ where: { sessionId: today.id } });
    const byKey = new Map(records.map((record) => [`${record.exerciseId}:${record.type}`, record]));
    expect(byKey.get(`${bench.id}:WEIGHT`)).toMatchObject({ value: 105, previousValue: 100 });
    expect(byKey.get(`${dip.id}:WEIGHT`)).toMatchObject({ value: 92.5, previousValue: 90 });
    expect(byKey.get(`null:WORKOUT_TONNAGE`)).toMatchObject({ value: 1265, previousValue: 1220 });
    // The warm-up never counted: 60 x 12 is not part of any baseline.
    expect(records.filter((record) => record.type === 'WEIGHT')).toHaveLength(2);
    expect(new Set(records.map((record) => `${record.exerciseId}:${record.type}`)).size).toBe(
      records.length,
    );

    const recent = await recentPersonalRecords(user.id, daysAgo(30), 20);
    expect(recent.find((record) => record.exerciseId === bench.id)?.exerciseName).toBe('Bench');
  });

  it('records nothing for a first session', async () => {
    const user = await db.user.create({ data: { email: 'first@test.dev', passwordHash: 'x' } });
    const bench = await db.exercise.create({
      data: { userId: user.id, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
    });
    const first = await db.session.create({ data: { userId: user.id, startedAt: daysAgo(0) } });
    await db.set.create({
      data: { sessionId: first.id, exerciseId: bench.id, setNumber: 1, weight: 100, reps: 5 },
    });
    mockUserId.mockResolvedValue(user.id);

    await finish(first.id);

    await expect(db.personalRecord.count({ where: { userId: user.id } })).resolves.toBe(0);
  });
});
