import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

// Onboarding answers: profile, availability, gym equipment and exercise
// preferences in one save; the exercise ids in the body are checked against
// what the caller may use (cross-user case for the ownership ratchet).

vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { DELETE as skipOnboarding, POST as saveOnboarding } from '@/app/api/onboarding/route';

function post(body: unknown) {
  return saveOnboarding(
    new Request('http://test.local/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

async function user(email: string) {
  return db.user.create({ data: { email, passwordHash: 'x' } });
}

async function customExercise(userId: string, name: string) {
  return db.exercise.create({
    data: { userId, name, muscleGroup: 'OTHER', category: 'ISOLATION' },
  });
}

beforeEach(() => mockUserId.mockReset());

describe('POST /api/onboarding', () => {
  it('saves profile, availability, gym and preferences, and marks onboarding done', async () => {
    const ana = await user('ana@test.dev');
    const disliked = await customExercise(ana.id, 'Leg press of doom');
    mockUserId.mockResolvedValue(ana.id);

    const res = await post({
      goal: 'HYPERTROPHY',
      experience: 'INTERMEDIATE',
      trainingDays: [1, 3, 5, 1],
      sessionMinutes: 60,
      preferredTrainingTime: 'evening',
      gym: { name: 'Academia A', availableEquipment: ['barbell', 'dumbbell', 'cable'] },
      priorityMuscles: ['CHEST', 'CHEST', 'SHOULDERS_LATERAL'],
      avoidExerciseIds: [disliked.id],
      bodyweight: 82.4,
      birthDate: '1990-05-17',
    });
    expect(res.status).toBe(200);

    const saved = await db.user.findUniqueOrThrow({
      where: { id: ana.id },
      include: { activeGym: true, exercisePreferences: true, bodyweightEntries: true },
    });
    expect(saved).toMatchObject({
      goal: 'HYPERTROPHY',
      experience: 'INTERMEDIATE',
      weeklyFrequency: 3,
      trainingDays: [1, 3, 5],
      sessionMinutes: 60,
      preferredTrainingTime: 'evening',
      priorityMuscles: ['CHEST', 'SHOULDERS_LATERAL'],
      bodyweight: 82.4,
    });
    expect(saved.onboardedAt).not.toBeNull();
    expect(saved.birthDate?.toISOString().slice(0, 10)).toBe('1990-05-17');
    expect(saved.activeGym).toMatchObject({
      name: 'Academia A',
      availableEquipment: ['barbell', 'dumbbell', 'cable'],
    });
    expect(saved.exercisePreferences).toEqual([
      expect.objectContaining({ exerciseId: disliked.id, kind: 'AVOID' }),
    ]);
    expect(saved.bodyweightEntries).toHaveLength(1);
  });

  it('replaces previous preferences and edits the active gym on a second save', async () => {
    const ana = await user('ana@test.dev');
    const first = await customExercise(ana.id, 'First');
    const second = await customExercise(ana.id, 'Second');
    mockUserId.mockResolvedValue(ana.id);

    await post({
      goal: 'STRENGTH',
      gym: { name: 'Casa', availableEquipment: ['dumbbell'] },
      avoidExerciseIds: [first.id],
    });
    await post({
      goal: 'STRENGTH',
      gym: { name: 'Casa', availableEquipment: ['dumbbell', 'band'] },
      avoidExerciseIds: [second.id],
    });

    const prefs = await db.exercisePreference.findMany({ where: { userId: ana.id } });
    expect(prefs.map((p) => p.exerciseId)).toEqual([second.id]);
    await expect(db.gym.count({ where: { userId: ana.id } })).resolves.toBe(1);
    const gym = await db.gym.findFirstOrThrow({ where: { userId: ana.id } });
    expect(gym.availableEquipment).toEqual(['dumbbell', 'band']);
  });

  it("refuses another user's exercise id and changes nothing", async () => {
    const ana = await user('ana@test.dev');
    const bia = await user('bia@test.dev');
    const biaOnly = await customExercise(bia.id, 'Bia only');
    mockUserId.mockResolvedValue(ana.id);

    const res = await post({ goal: 'STRENGTH', avoidExerciseIds: [biaOnly.id] });
    expect(res.status).toBe(400);
    const after = await db.user.findUniqueOrThrow({ where: { id: ana.id } });
    expect(after.goal).toBeNull();
    expect(after.onboardedAt).toBeNull();
  });

  it('requires a goal', async () => {
    const ana = await user('ana@test.dev');
    mockUserId.mockResolvedValue(ana.id);
    expect((await post({ experience: 'BEGINNER' })).status).toBe(400);
  });
});

describe('DELETE /api/onboarding (skip)', () => {
  it('marks onboarding as done without touching the profile', async () => {
    const ana = await user('ana@test.dev');
    mockUserId.mockResolvedValue(ana.id);

    expect((await skipOnboarding()).status).toBe(200);
    const after = await db.user.findUniqueOrThrow({ where: { id: ana.id } });
    expect(after.onboardedAt).not.toBeNull();
    expect(after.goal).toBeNull();
  });
});
