import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { photoRelativePath, progressPhotoStorageDir, writePhotoFile } from '@/lib/progress-photo';
import { USER_OWNED_MODELS } from '@/lib/account-data';
import { deletionSubjectHash } from '@/lib/account-deletion';
import { buildAccountExport } from '@/lib/account-export';

// Erasing an account and exporting it (LGPD, epic 1.7), on an account with
// data in every user-owned table, next to a second account that must stay
// untouched.

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(),
  getCurrentUserId: vi.fn(),
  SESSION_COOKIE: 'gymcoach-session',
}));
const cookieDelete = vi.fn();
vi.mock('next/headers', () => ({
  cookies: async () => ({ delete: cookieDelete, get: () => undefined }),
}));

import { getCurrentSession } from '@/lib/auth';
import { POST as deleteAccountRoute } from '@/app/api/account/delete/route';

const mockedSession = vi.mocked(getCurrentSession);
const PASSWORD = 'correct-horse-battery';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

let uploadsDir: string;
const previousUploadsDir = process.env.UPLOADS_DIR;

beforeAll(async () => {
  uploadsDir = await mkdtemp(path.join(os.tmpdir(), 'gympeg-account-test-'));
  process.env.UPLOADS_DIR = uploadsDir;
});

afterAll(async () => {
  if (previousUploadsDir === undefined) delete process.env.UPLOADS_DIR;
  else process.env.UPLOADS_DIR = previousUploadsDir;
  await rm(uploadsDir, { recursive: true, force: true });
});

beforeEach(() => {
  mockedSession.mockReset();
  cookieDelete.mockReset();
});

// One row (at least) in every model of lib/account-data, plus the rows they own.
async function seedEverything(email: string) {
  const user = await db.user.create({
    data: {
      email,
      passwordHash: await hashPassword(PASSWORD),
      displayName: 'Lifter',
      bodyweight: 80,
    },
  });
  const userId = user.id;
  const exercise = await db.exercise.create({
    data: { userId, name: `Custom press ${email}`, muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  const gym = await db.gym.create({ data: { userId, name: `Gym ${email}` } });
  await db.user.update({ where: { id: userId }, data: { activeGymId: gym.id } });
  const equipment = await db.gymEquipment.create({
    data: {
      gymId: gym.id,
      name: 'Rack',
      equipmentType: 'BARBELL',
      imageData: PNG,
      imageMimeType: 'image/png',
      exerciseLinks: { create: [{ exerciseId: exercise.id }] },
    },
  });
  await db.gymExerciseConfig.create({ data: { gymId: gym.id, exerciseId: exercise.id } });
  const program = await db.program.create({
    data: { userId, name: 'Block', phase: 'Base', isActive: true },
  });
  const workout = await db.workout.create({
    data: { programId: program.id, name: 'Push', order: 1 },
  });
  await db.programExercise.create({
    data: {
      workoutId: workout.id,
      exerciseId: exercise.id,
      order: 1,
      targetSets: 3,
      targetRepsMin: 6,
      targetRepsMax: 8,
      targetRIR: 2,
      restSec: 120,
    },
  });
  const revision = await db.programRevision.create({
    data: { programId: program.id, version: 1, source: 'CREATED', snapshot: {}, contentHash: 'x' },
  });
  const session = await db.session.create({
    data: {
      userId,
      programId: program.id,
      workoutId: workout.id,
      gymId: gym.id,
      programRevisionId: revision.id,
      finishedAt: new Date(),
    },
  });
  await db.trainingRecommendation.create({
    data: {
      userId,
      sessionId: session.id,
      exerciseId: exercise.id,
      action: 'HOLD',
      valueKg: 60,
      reason: 'within-range',
      inputs: {},
      guidelineVersion: 'test',
    },
  });
  await db.deloadPeriod.create({
    data: {
      userId,
      trigger: 'RECOMMENDED',
      reasons: ['long-block'],
      endsAt: new Date(Date.now() + 7 * 86_400_000),
    },
  });
  await db.personalRecord.create({
    data: {
      userId,
      sessionId: session.id,
      exerciseId: exercise.id,
      type: 'WEIGHT',
      value: 62.5,
      previousValue: 60,
      achievedAt: new Date(),
    },
  });
  await db.set.create({
    data: {
      sessionId: session.id,
      exerciseId: exercise.id,
      gymEquipmentId: equipment.id,
      setNumber: 1,
      weight: 80,
      reps: 8,
      rir: 2,
      notes: 'felt, strong',
    },
  });
  await db.conversation.create({
    data: { userId, title: 'Chat', messages: { create: [{ role: 'USER', content: 'Hi coach' }] } },
  });
  await db.coachSession.create({
    data: { userId, weekStart: new Date(), weekEnd: new Date(), prompt: 'p', response: 'r' },
  });
  await db.exerciseGoal.create({
    data: { userId, exerciseId: exercise.id, targetWeight: 100, targetReps: 5 },
  });
  await db.exercisePreference.create({ data: { userId, exerciseId: exercise.id, kind: 'PREFER' } });
  await db.volumeTarget.create({ data: { userId, muscleGroup: 'CHEST', mev: 8, mrv: 20 } });
  await db.bodyweightEntry.create({ data: { userId, weightKg: 80.5 } });
  await db.bodyMeasurement.create({ data: { userId, site: 'WAIST', valueCm: 82 } });
  await db.readinessCheckin.create({ data: { userId, readiness: 4, sleepQuality: 3 } });
  await db.authSession.create({
    data: { userId, expiresAt: new Date(Date.now() + 86_400_000), userAgent: 'vitest' },
  });
  await db.mcpAccessToken.create({
    data: { userId, name: 'Assistant', tokenHash: `secret-hash-${email}`, tokenPrefix: 'gp_abc' },
  });
  await db.passwordResetToken.create({
    data: {
      userId,
      tokenHash: `reset-hash-${email}`,
      expiresAt: new Date(Date.now() + 1_800_000),
    },
  });
  await db.mcpHistoricalEquipmentBackfillAudit.create({
    data: {
      userId,
      gymId: gym.id,
      exerciseId: exercise.id,
      equipmentId: equipment.id,
      setIds: [],
      equipmentSnapshot: {},
    },
  });
  const photo = await db.progressPhoto.create({
    data: { userId, storagePath: 'pending', mimeType: 'image/png', byteSize: PNG.length },
  });
  const relPath = photoRelativePath(userId, photo.id, 'image/png');
  await writePhotoFile(relPath, PNG);
  await db.progressPhoto.update({ where: { id: photo.id }, data: { storagePath: relPath } });
  return { user, exercise, photoPath: relPath };
}

async function rowsOf(userId: string) {
  const counts: Record<string, number> = {};
  for (const [model, { delegate }] of Object.entries(USER_OWNED_MODELS)) {
    counts[model] = await (
      db as unknown as Record<string, { count: (args: unknown) => Promise<number> }>
    )[delegate]!.count({ where: { userId } });
  }
  return counts;
}

function deleteRequest(body: unknown) {
  return new Request('http://test.local/api/account/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function signIn(user: { id: string; email: string }) {
  mockedSession.mockResolvedValue({ userId: user.id, email: user.email, sid: 'sid' } as never);
}

describe('POST /api/account/delete', () => {
  it('erases every row and file of the account and keeps proof of the erasure', async () => {
    const { user, photoPath } = await seedEverything('erase@test.dev');
    const other = await seedEverything('keep@test.dev');
    const before = await rowsOf(other.user.id);
    signIn(user);

    const res = await deleteAccountRoute(
      deleteRequest({ password: PASSWORD, confirmEmail: 'ERASE@test.dev' }),
    );

    expect(res.status).toBe(200);
    expect(cookieDelete).toHaveBeenCalledWith('gymcoach-session');
    expect(await db.user.findUnique({ where: { id: user.id } })).toBeNull();
    for (const [model, count] of Object.entries(await rowsOf(user.id))) {
      expect(count, `${model} rows left`).toBe(0);
    }
    expect(await db.set.count({ where: { session: { userId: user.id } } })).toBe(0);
    expect(await db.workout.count({ where: { program: { userId: user.id } } })).toBe(0);
    expect(await db.gymEquipment.count({ where: { gym: { userId: user.id } } })).toBe(0);
    await expect(stat(path.join(progressPhotoStorageDir(), photoPath))).rejects.toThrow();

    const proof = await db.accountDeletion.findUniqueOrThrow({
      where: { subjectHash: deletionSubjectHash(user.id) },
    });
    expect(proof.counts).toMatchObject({ sessions: 1, programs: 1, sets: 1, progressPhotos: 1 });
    expect(JSON.stringify(proof)).not.toContain('erase@test.dev');

    // The other account is untouched, its photo too.
    expect(await rowsOf(other.user.id)).toEqual(before);
    await expect(stat(path.join(progressPhotoStorageDir(), other.photoPath))).resolves.toBeTruthy();
  });

  it('refuses a wrong password or a different e-mail and erases nothing', async () => {
    const { user } = await seedEverything('careful@test.dev');
    signIn(user);

    const wrongPassword = await deleteAccountRoute(
      deleteRequest({ password: 'nope', confirmEmail: 'careful@test.dev' }),
    );
    const wrongEmail = await deleteAccountRoute(
      deleteRequest({ password: PASSWORD, confirmEmail: 'someone@test.dev' }),
    );

    expect([wrongPassword.status, wrongEmail.status]).toEqual([400, 400]);
    expect(await db.user.findUnique({ where: { id: user.id } })).not.toBeNull();
    expect((await rowsOf(user.id)).Session).toBe(1);
  });

  it('refuses an anonymous caller', async () => {
    mockedSession.mockResolvedValue(null);

    const res = await deleteAccountRoute(
      deleteRequest({ password: 'x', confirmEmail: 'x@test.dev' }),
    );

    expect(res.status).toBe(401);
  });
});

describe('account export', () => {
  async function unzip(userId: string) {
    const { filename, stream } = await buildAccountExport(userId, {
      readme: 'README',
      now: new Date('2026-10-09T12:00:00Z'),
    });
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    return { filename, files: unzipSync(bytes) };
  }

  it('holds every kind of data of the account, and no credential', async () => {
    const { user, exercise } = await seedEverything('export@test.dev');
    await seedEverything('stranger@test.dev');

    const { filename, files } = await unzip(user.id);

    expect(filename).toBe('gympeg-export-2026-10-09.zip');
    const data = JSON.parse(strFromU8(files['data.json']!));
    expect(data).toMatchObject({ format: 'gympeg-export', version: 1 });
    expect(data.account).toMatchObject({ email: 'export@test.dev', displayName: 'Lifter' });
    for (const { delegate } of Object.values(USER_OWNED_MODELS)) {
      expect(Array.isArray(data[delegate]), `${delegate} exported`).toBe(true);
      expect(data[delegate].length, `${delegate} has rows`).toBeGreaterThan(0);
    }
    expect(data.session[0].sets[0]).toMatchObject({ weight: 80, reps: 8 });
    expect(data.program[0].workouts[0].exercises[0].exerciseId).toBe(exercise.id);
    expect(data.program[0].revisions).toHaveLength(1);
    expect(data.conversation[0].messages[0].content).toBe('Hi coach');

    const everything = strFromU8(files['data.json']!);
    expect(everything).not.toContain('passwordHash');
    expect(everything).not.toContain('secret-hash-export@test.dev');
    expect(everything).not.toContain('reset-hash-export@test.dev');
    expect(everything).not.toContain('stranger@test.dev');

    const photoNames = Object.keys(files).filter((name) => name.startsWith('photos/'));
    expect(photoNames).toHaveLength(1);
    expect(files[photoNames[0]!]).toEqual(PNG);
    expect(Object.keys(files).some((name) => name.startsWith('gym-equipment/'))).toBe(true);

    const setsCsv = strFromU8(files['csv/sets.csv']!).trim().split('\n');
    expect(setsCsv).toHaveLength(2);
    expect(setsCsv[1]).toContain(`Custom press export@test.dev`);
    expect(setsCsv[1]).toContain('"felt, strong"');
    expect(strFromU8(files['README.txt']!)).toBe('README');
  });
});
