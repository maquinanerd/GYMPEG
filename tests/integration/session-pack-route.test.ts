import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

// GET /api/session-pack: what the device stores to run the active program's
// workouts offline (ADR-004). Only the caller's own data, never cached.

vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { GET as getPack } from '@/app/api/session-pack/route';

async function seedLifter(email: string, workoutName: string) {
  const user = await db.user.create({ data: { email, passwordHash: 'x', unit: 'LB' } });
  const gym = await db.gym.create({ data: { userId: user.id, name: `${workoutName} gym` } });
  await db.user.update({ where: { id: user.id }, data: { activeGymId: gym.id } });
  const bench = await db.exercise.create({
    data: {
      userId: user.id,
      name: `${workoutName} press`,
      muscleGroup: 'CHEST',
      category: 'COMPOUND',
    },
  });
  const program = await db.program.create({
    data: { userId: user.id, name: `${workoutName} block`, phase: 'Base', isActive: true },
  });
  const workout = await db.workout.create({
    data: { programId: program.id, name: workoutName, order: 1 },
  });
  await db.programExercise.create({
    data: {
      workoutId: workout.id,
      exerciseId: bench.id,
      order: 1,
      targetSets: 3,
      targetRepsMin: 6,
      targetRepsMax: 10,
      targetRIR: 2,
      restSec: 120,
    },
  });
  const past = await db.session.create({
    data: {
      userId: user.id,
      workoutId: workout.id,
      programId: program.id,
      startedAt: new Date(Date.now() - 3 * 86_400_000),
      finishedAt: new Date(Date.now() - 3 * 86_400_000 + 3_600_000),
    },
  });
  await db.set.create({
    data: { sessionId: past.id, exerciseId: bench.id, setNumber: 1, weight: 80, reps: 8, rir: 2 },
  });
  return { user, gym, bench, workout };
}

beforeEach(() => mockUserId.mockReset());

describe('GET /api/session-pack', () => {
  it("packs the caller's active program with last performances, gyms and preferences", async () => {
    const lifter = await seedLifter('pack@test.dev', 'Push');
    await seedLifter('stranger@test.dev', 'Pull');
    mockUserId.mockResolvedValue(lifter.user.id);

    const res = await getPack();

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const pack = await res.json();
    expect(pack.unit).toBe('LB');
    expect(pack.activeGymId).toBe(lifter.gym.id);
    expect(pack.gyms.map((gym: { name: string }) => gym.name)).toEqual(['Push gym']);
    expect(pack.workouts).toHaveLength(1);
    expect(pack.workouts[0].workout).toMatchObject({ id: lifter.workout.id, name: 'Push' });
    expect(pack.workouts[0].workout.exercises[0].exercise.name).toBe('Push press');
    expect(pack.workouts[0].lastPerformances[lifter.bench.id]).toMatchObject({
      maxWeight: 80,
      repsAtMaxWeight: 8,
    });
    // Nothing of the other account: program, workout, gym, private exercise.
    const serialized = JSON.stringify(pack);
    for (const foreign of ['Pull block', '"Pull"', 'Pull gym', 'Pull press']) {
      expect(serialized).not.toContain(foreign);
    }
  });

  it('returns an empty pack when there is no active program', async () => {
    const user = await db.user.create({ data: { email: 'empty@test.dev', passwordHash: 'x' } });
    mockUserId.mockResolvedValue(user.id);

    const pack = await (await getPack()).json();

    expect(pack.program).toBeNull();
    expect(pack.workouts).toEqual([]);
  });

  it('refuses an anonymous caller', async () => {
    mockUserId.mockResolvedValue(null);

    expect((await getPack()).status).toBe(401);
  });
});
