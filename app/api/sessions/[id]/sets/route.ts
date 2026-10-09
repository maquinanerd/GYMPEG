import { NextResponse } from 'next/server';
import type { Exercise, Set } from '@/lib/prisma-client';
import { db } from '@/lib/db';
import { resolveSetType, setInputSchema, validateSetForCategory } from '@/lib/schemas/set';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { setAchievesGoal } from '@/lib/goals';
import { effectiveWeight } from '@/lib/stats';
import { resolveSetEquipmentSnapshot } from '@/lib/set-equipment';
import { acceptsSetAfterFinish, resolvePerformedAt } from '@/lib/set-timing';
import { Prisma } from '@/prisma/generated/client';
import { usableExerciseWhere } from '@/lib/catalog/access';
import { parseExerciseSwaps } from '@/lib/session-swaps';
import { deloadPrescription, isDeloadWeek, programCycle } from '@/lib/program-cycle';

interface Params {
  params: Promise<{ id: string }>;
}

// POST /api/sessions/[id]/sets: records a set in a session.
//
// Idempotent when the offline queue sends `clientMutationId`: a retried POST
// (lost response, reload, two tabs) returns the set already stored with that
// key instead of creating a duplicate. `performedAt` (device clock, bounded)
// becomes completedAt, so a set logged offline keeps the time it was done.
export async function POST(req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();

    // Scoped reads (issue #317): ownership is part of each query, not a
    // separate comparison that a later edit could drop.
    const session = await db.session.findFirst({ where: { id: params.id, userId } });
    if (!session) {
      throw new ApiError(404, 'Session not found.');
    }

    const data = await parseJsonBody(req, setInputSchema);

    // Replay of a set this session already stored: answer with it (200) so the
    // client marks it synced, whatever the session state is now.
    if (data.clientMutationId) {
      const existing = await db.set.findUnique({
        where: {
          sessionId_clientMutationId: {
            sessionId: params.id,
            clientMutationId: data.clientMutationId,
          },
        },
      });
      if (existing) return NextResponse.json(existing, { status: 200 });
    }

    const performedAt = resolvePerformedAt(data.performedAt, {
      now: new Date(),
      sessionStartedAt: session.startedAt,
    });
    if (!acceptsSetAfterFinish(session.finishedAt, performedAt, data.clientMutationId)) {
      throw new ApiError(400, 'Session already finished.');
    }

    // Validation: the exercise must belong to the user.
    const exercise = await db.exercise.findFirst({
      where: { id: data.exerciseId, ...usableExerciseWhere(userId) },
    });
    if (!exercise) {
      throw new ApiError(400, 'Invalid exercise.');
    }

    // Cardio cross-field rule (issue #133): duration/distance only on CARDIO
    // exercises, and a cardio set requires a duration.
    const categoryError = validateSetForCategory(exercise.category, data);
    if (categoryError) {
      throw new ApiError(400, categoryError);
    }
    const isCardio = exercise.category === 'CARDIO';
    const kind = resolveSetType(data);

    // Target x actual: the prescription of this exercise in the session's
    // workout, frozen on the set so later program edits do not rewrite it.
    // An exercise replaced only for this session takes its row's targets.
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
    // Bodyweight at log time for bodyweight exercises.
    const bodyweightKgSnapshot = exercise.usesBodyweight
      ? ((await db.user.findUnique({ where: { id: userId }, select: { bodyweight: true } }))
          ?.bodyweight ?? null)
      : null;

    let created: Set;
    try {
      created = await db.$transaction(async (tx) => {
        const canonicalWeight = isCardio ? 0 : data.weight;
        const equipmentSnapshot = await resolveSetEquipmentSnapshot(tx, {
          userId,
          sessionGymId: session.gymId,
          exerciseId: data.exerciseId,
          gymEquipmentId: data.gymEquipmentId,
        });
        return tx.set.create({
          data: {
            sessionId: params.id,
            exerciseId: data.exerciseId,
            ...equipmentSnapshot,
            setNumber: data.setNumber,
            // Cardio sets store weight = 0 / reps = 1 by convention (the columns
            // are NOT NULL); the UI never shows them for CARDIO exercises.
            weight: canonicalWeight,
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
      // Two concurrent POSTs with the same key (two tabs, a retry racing the
      // original): the loser returns the winner's row instead of failing.
      if (
        data.clientMutationId &&
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const winner = await db.set.findUnique({
          where: {
            sessionId_clientMutationId: {
              sessionId: params.id,
              clientMutationId: data.clientMutationId,
            },
          },
        });
        if (winner) return NextResponse.json(winner, { status: 200 });
      }
      throw err;
    }
    // Best-effort: the set is already committed, so a failure here must never
    // fail the request (a 500 would make the offline sync retry the POST and
    // duplicate the set). An unstamped goal self-heals on the next achieving
    // set or on goal re-creation, which re-derives achievedAt from history.
    try {
      await stampGoalIfAchieved(userId, exercise, created);
    } catch (stampErr) {
      console.error('[api] goal achievement stamping failed:', stampErr);
    }

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
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
// unachieved goal's target, stamp achievedAt with the set's completedAt
// (deterministic - the same instant the goal-creation path would derive).
// Comparison runs on the effective load (bodyweight + added load for
// bodyweight exercises), consistent with lib/stats.
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
