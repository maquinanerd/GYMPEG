// Create, correct and delete logged sets (ADR-004). One implementation for
// the single-set routes and the batched sync push, so both apply the same
// ownership, timing, target and goal rules.
//
// Deletion leaves a tombstone keyed by the set's clientMutationId: a create
// replayed after the delete (lost response, another tab, a delete that
// overtook its create in the outbox) answers 410 instead of bringing the set
// back.

import type { Exercise, Set } from '@/lib/prisma-client';
import { Prisma } from '@/prisma/generated/client';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/api';
import { usableExerciseWhere } from '@/lib/catalog/access';
import { findAchievingSet, setAchievesGoal } from '@/lib/goals';
import { deloadPrescription, isDeloadWeek, programCycle } from '@/lib/program-cycle';
import {
  resolveSetType,
  validateSetForCategory,
  type SetInput,
  type SetUpdateInput,
} from '@/lib/schemas/set';
import { parseExerciseSwaps } from '@/lib/session-swaps';
import { resolveSetEquipmentSnapshot } from '@/lib/set-equipment';
import { acceptsSetAfterFinish, resolvePerformedAt } from '@/lib/set-timing';
import { effectiveWeight } from '@/lib/stats';

export const SET_DELETED_MESSAGE = 'This set was deleted.';

function findByMutationId(sessionId: string, clientMutationId: string) {
  return db.set.findUnique({
    where: { sessionId_clientMutationId: { sessionId, clientMutationId } },
  });
}

// Records a set in a session of the user. Idempotent on clientMutationId: a
// replay returns the stored row (`replayed`), a replay of a deleted set is
// refused with 410. performedAt (device clock, bounded) becomes completedAt.
export async function createSessionSet(
  userId: string,
  sessionId: string,
  data: SetInput,
): Promise<{ set: Set; replayed: boolean }> {
  // Scoped reads (issue #317): ownership is part of each query.
  const session = await db.session.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw new ApiError(404, 'Session not found.');

  if (data.clientMutationId) {
    const existing = await findByMutationId(sessionId, data.clientMutationId);
    if (existing) return { set: existing, replayed: true };
    const tombstone = await db.setTombstone.findUnique({
      where: {
        sessionId_clientMutationId: { sessionId, clientMutationId: data.clientMutationId },
      },
      select: { id: true },
    });
    if (tombstone) throw new ApiError(410, SET_DELETED_MESSAGE);
  }

  const performedAt = resolvePerformedAt(data.performedAt, {
    now: new Date(),
    sessionStartedAt: session.startedAt,
  });
  if (!acceptsSetAfterFinish(session.finishedAt, performedAt, data.clientMutationId)) {
    throw new ApiError(400, 'Session already finished.');
  }

  const exercise = await db.exercise.findFirst({
    where: { id: data.exerciseId, ...usableExerciseWhere(userId) },
  });
  if (!exercise) throw new ApiError(400, 'Invalid exercise.');

  // Cardio cross-field rule (issue #133).
  const categoryError = validateSetForCategory(exercise.category, data);
  if (categoryError) throw new ApiError(400, categoryError);
  const isCardio = exercise.category === 'CARDIO';
  const kind = resolveSetType(data);

  // Target x actual: the prescription of this exercise in the session's
  // workout, frozen on the set. An exercise replaced only for this session
  // takes its row's targets.
  const swappedRowId = Object.entries(parseExerciseSwaps(session.exerciseSwaps)).find(
    ([, exerciseId]) => exerciseId === data.exerciseId,
  )?.[0];
  const prescription = session.workoutId
    ? await db.programExercise.findFirst({
        where: {
          workoutId: session.workoutId,
          ...(swappedRowId ? { id: swappedRowId } : { exerciseId: data.exerciseId }),
        },
        orderBy: { order: 'asc' },
        select: { targetRepsMin: true, targetRepsMax: true, targetRIR: true, targetSets: true },
      })
    : null;
  // In the deload week of the program's cycle the session ran a lighter
  // prescription: that is the target the set was logged against.
  const deloadWeek = await sessionInDeloadWeek(session);
  const target = prescription && deloadWeek ? deloadPrescription(prescription) : prescription;
  const bodyweightKgSnapshot = exercise.usesBodyweight
    ? ((await db.user.findUnique({ where: { id: userId }, select: { bodyweight: true } }))
        ?.bodyweight ?? null)
    : null;

  let created: Set;
  try {
    created = await db.$transaction(async (tx) => {
      const equipmentSnapshot = await resolveSetEquipmentSnapshot(tx, {
        userId,
        sessionGymId: session.gymId,
        exerciseId: data.exerciseId,
        gymEquipmentId: data.gymEquipmentId,
      });
      return tx.set.create({
        data: {
          sessionId,
          exerciseId: data.exerciseId,
          ...equipmentSnapshot,
          setNumber: data.setNumber,
          // Cardio sets store weight = 0 / reps = 1 by convention (the columns
          // are NOT NULL); the UI never shows them for CARDIO exercises.
          weight: isCardio ? 0 : data.weight,
          reps: isCardio ? 1 : data.reps,
          rir: isCardio ? null : (data.rir ?? null),
          durationSec: isCardio ? data.durationSec : null,
          distanceM: isCardio ? (data.distanceM ?? null) : null,
          avgHr: isCardio ? (data.avgHr ?? null) : null,
          maxHr: isCardio ? (data.maxHr ?? null) : null,
          notes: data.notes ?? null,
          ...kind,
          rpe: isCardio ? null : (data.rpe ?? null),
          targetRepsMin: isCardio ? null : (target?.targetRepsMin ?? null),
          targetRepsMax: isCardio ? null : (target?.targetRepsMax ?? null),
          targetRir: isCardio ? null : (target?.targetRIR ?? null),
          bodyweightKgSnapshot,
          clientMutationId: data.clientMutationId ?? null,
          completedAt: performedAt,
        },
      });
    });
  } catch (err) {
    // Two concurrent creates with the same key (two tabs, a retry racing the
    // original): the loser returns the winner's row instead of failing.
    if (
      data.clientMutationId &&
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      const winner = await findByMutationId(sessionId, data.clientMutationId);
      if (winner) return { set: winner, replayed: true };
    }
    throw err;
  }
  // Best-effort: the set is already committed, so a failure here must never
  // fail the request (a 500 would make the offline sync retry the create).
  try {
    await stampGoalIfAchieved(userId, exercise, created);
  } catch (stampErr) {
    console.error('[sets] goal achievement stamping failed:', stampErr);
  }
  return { set: created, replayed: false };
}

// Corrects the strength values of a set in an open session. `sessionId`
// narrows the set to one session (the batched push).
export async function updateOwnedSet(
  userId: string,
  setId: string,
  data: SetUpdateInput,
  scope: { sessionId?: string } = {},
): Promise<Set> {
  return runSerializableSetTransaction(async (tx) => {
    // Serialize same-set mutations first, then goal re-derivation for the
    // exercise, so the set values and achievedAt commit together.
    await tx.$queryRaw`SELECT "Set".id FROM "Set" JOIN "Session" ON "Session".id = "Set"."sessionId" WHERE "Set".id = ${setId} AND "Session"."userId" = ${userId} FOR UPDATE OF "Set"`;
    const set = await tx.set.findFirst({
      where: {
        id: setId,
        session: { userId },
        ...(scope.sessionId ? { sessionId: scope.sessionId } : {}),
      },
      include: {
        session: { select: { finishedAt: true } },
        exercise: { select: { category: true } },
      },
    });
    if (!set) throw new ApiError(404, 'Set not found.');
    if (set.session.finishedAt) throw new ApiError(400, 'Session already finished.');
    if (set.exercise.category === 'CARDIO') {
      throw new ApiError(400, 'Cardio sets cannot be edited with strength fields.');
    }

    await lockExerciseGoal(tx, userId, set.exerciseId);
    const row = await tx.set.update({
      where: { id: set.id, session: { userId } },
      data: {
        weight: data.weight,
        reps: data.reps,
        rir: data.rir,
        // RPE is optional on an edit: absent keeps the stored value.
        ...(data.rpe !== undefined ? { rpe: data.rpe } : {}),
      },
    });
    await rederiveGoalAchievement(tx, userId, set.exerciseId, true);
    return row;
  });
}

// Deletes a set of the user (404 when there is none), leaving a tombstone
// when it carries a device key.
export async function deleteOwnedSet(
  userId: string,
  setId: string,
  scope: { sessionId?: string } = {},
): Promise<void> {
  await runSerializableSetTransaction(async (tx) => {
    await tx.$queryRaw`SELECT "Set".id FROM "Set" JOIN "Session" ON "Session".id = "Set"."sessionId" WHERE "Set".id = ${setId} AND "Session"."userId" = ${userId} FOR UPDATE OF "Set"`;
    const set = await tx.set.findFirst({
      where: {
        id: setId,
        session: { userId },
        ...(scope.sessionId ? { sessionId: scope.sessionId } : {}),
      },
    });
    if (!set) throw new ApiError(404, 'Set not found.');
    await removeSet(tx, userId, set);
  });
}

// Deletes the set a device logged under `clientMutationId` in a session of
// the user. Idempotent: when the set never reached the server (or is already
// gone) only the tombstone is written, so its create can no longer land.
export async function deleteSessionSetByMutationId(
  userId: string,
  sessionId: string,
  clientMutationId: string,
): Promise<void> {
  await runSerializableSetTransaction(async (tx) => {
    const session = await tx.session.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!session) throw new ApiError(404, 'Session not found.');
    await tx.$queryRaw`SELECT id FROM "Set" WHERE "sessionId" = ${sessionId} AND "clientMutationId" = ${clientMutationId} FOR UPDATE`;
    const set = await tx.set.findUnique({
      where: { sessionId_clientMutationId: { sessionId, clientMutationId } },
    });
    if (set) {
      await removeSet(tx, userId, set);
    } else {
      await writeTombstone(tx, sessionId, clientMutationId);
    }
  });
}

async function removeSet(tx: Prisma.TransactionClient, userId: string, set: Set): Promise<void> {
  await lockExerciseGoal(tx, userId, set.exerciseId);
  await tx.set.delete({ where: { id: set.id, session: { userId } } });
  if (set.clientMutationId) await writeTombstone(tx, set.sessionId, set.clientMutationId);
  await rederiveGoalAchievement(tx, userId, set.exerciseId, false);
}

async function writeTombstone(
  tx: Prisma.TransactionClient,
  sessionId: string,
  clientMutationId: string,
): Promise<void> {
  await tx.setTombstone.upsert({
    where: { sessionId_clientMutationId: { sessionId, clientMutationId } },
    create: { sessionId, clientMutationId },
    update: {},
  });
}

async function sessionInDeloadWeek(session: {
  programId: string | null;
  cycleWeek: number | null;
}): Promise<boolean> {
  if (!session.programId || session.cycleWeek == null) return false;
  const program = await db.program.findUnique({
    where: { id: session.programId },
    select: { cycleWeeks: true, cycleDeloadWeek: true, cycleAnchor: true },
  });
  const cycle = program ? programCycle(program) : null;
  return cycle != null && isDeloadWeek(cycle, session.cycleWeek);
}

// Per-exercise goal (issue #90): when a freshly logged working set meets an
// unachieved goal's target, stamp achievedAt with the set's completedAt.
// Comparison runs on the effective load, consistent with lib/stats.
async function stampGoalIfAchieved(userId: string, exercise: Exercise, set: Set): Promise<void> {
  if (set.isWarmup) return;
  const goal = await db.exerciseGoal.findUnique({
    where: { userId_exerciseId: { userId, exerciseId: exercise.id } },
  });
  if (!goal || goal.achievedAt) return;

  let weight = set.weight;
  if (exercise.usesBodyweight) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { bodyweight: true },
    });
    weight = effectiveWeight(set.weight, true, user?.bodyweight);
  }
  if (setAchievesGoal({ weight, reps: set.reps, isWarmup: set.isWarmup }, goal)) {
    await db.exerciseGoal.update({
      where: { id: goal.id },
      data: { achievedAt: set.completedAt },
    });
  }
}

const MAX_SERIALIZABLE_ATTEMPTS = 3;

async function runSerializableSetTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_SERIALIZABLE_ATTEMPTS; attempt += 1) {
    try {
      return await db.$transaction(operation, { isolationLevel: 'Serializable' });
    } catch (err) {
      const isWriteConflict =
        typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2034';
      if (!isWriteConflict || attempt === MAX_SERIALIZABLE_ATTEMPTS) throw err;
    }
  }

  throw new Error('Serializable set transaction retry exhausted.');
}

async function lockExerciseGoal(
  tx: Prisma.TransactionClient,
  userId: string,
  exerciseId: string,
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "ExerciseGoal" WHERE "userId" = ${userId} AND "exerciseId" = ${exerciseId} FOR UPDATE`;
}

// A deleted or edited set may change which set achieved the exercise's goal
// (issue #96). Re-derive achievedAt from the remaining sets: clear it when
// nothing meets the target anymore, or re-stamp it with the earliest remaining
// achieving set.
async function rederiveGoalAchievement(
  tx: Prisma.TransactionClient,
  userId: string,
  exerciseId: string,
  allowAchievement: boolean,
): Promise<void> {
  const goal = await tx.exerciseGoal.findUnique({
    where: { userId_exerciseId: { userId, exerciseId } },
  });
  if (!goal || (!allowAchievement && !goal.achievedAt)) return;

  const [exercise, sets] = await Promise.all([
    tx.exercise.findFirst({
      where: { id: exerciseId, ...usableExerciseWhere(userId) },
      select: { usesBodyweight: true },
    }),
    tx.set.findMany({
      where: { exerciseId, isWarmup: false, session: { userId } },
      select: { weight: true, reps: true, isWarmup: true, completedAt: true },
    }),
  ]);
  if (!exercise) return;

  let bodyweight: number | null = null;
  if (exercise.usesBodyweight) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { bodyweight: true },
    });
    bodyweight = user?.bodyweight ?? null;
  }

  const achieving = findAchievingSet(
    sets.map((s) => ({
      ...s,
      weight: effectiveWeight(s.weight, exercise.usesBodyweight, bodyweight),
    })),
    goal,
  );
  const achievedAt = achieving?.completedAt ?? null;
  if (achievedAt?.getTime() !== goal.achievedAt?.getTime()) {
    await tx.exerciseGoal.update({
      where: { id: goal.id },
      data: { achievedAt },
    });
  }
}
