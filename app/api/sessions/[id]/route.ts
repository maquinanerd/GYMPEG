import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessionUpdateSchema } from '@/lib/schemas/session';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { resolveFinishedAt } from '@/lib/set-timing';
import { usableExerciseWhere } from '@/lib/catalog/access';
import { recordSessionPersonalRecords } from '@/lib/personal-records';
import type { ExerciseSwaps } from '@/lib/session-swaps';
import { log } from '@/lib/log';

interface Params {
  params: Promise<{ id: string }>;
}

// Ownership is enforced by scoping every query with userId (issue #317):
// the read that serves the response is itself the check, and the writes
// carry userId in their where, so a stranger's id yields 404 (null read or
// Prisma P2025 via handleApiError).

export async function GET(_req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    const session = await db.session.findFirst({
      where: { id: params.id, userId },
      include: {
        workout: {
          include: {
            exercises: {
              orderBy: { order: 'asc' },
              include: { exercise: true },
            },
          },
        },
        program: true,
        sets: { orderBy: [{ exerciseId: 'asc' }, { setNumber: 'asc' }] },
      },
    });
    if (!session) throw new ApiError(404, 'Session not found.');
    return NextResponse.json(session);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    const session = await db.session.findFirst({ where: { id: params.id, userId } });
    if (!session) throw new ApiError(404, 'Session not found.');
    const data = await parseJsonBody(req, sessionUpdateSchema);

    // A finish keeps the first finishedAt: the offline outbox may replay it,
    // and a second device must not move it. A finish queued offline carries
    // the device time.
    const finishedAt =
      data.finish && !session.finishedAt
        ? resolveFinishedAt(data.finishedAt, {
            now: new Date(),
            sessionStartedAt: session.startedAt,
          })
        : session.finishedAt;
    const exerciseSwaps =
      data.exerciseSwaps !== undefined
        ? await validatedSwaps(userId, session.workoutId, data.exerciseSwaps)
        : undefined;
    const updated = await db.session.update({
      where: { id: params.id, userId },
      data: {
        notes: data.notes ?? session.notes,
        finishedAt,
        ...(exerciseSwaps !== undefined ? { exerciseSwaps } : {}),
      },
    });
    // What this session beat (epic 2.2), once it is finished. Best effort: a
    // failure must not fail the finish (the offline outbox would retry it).
    if (data.finish && updated.finishedAt) {
      try {
        await recordSessionPersonalRecords(userId, updated.id);
      } catch (recordErr) {
        log.error('sessions.personal_records_failed', { err: recordErr });
      }
    }
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

// Replaced exercises must point from a row of the session's workout to an
// exercise the user can use. A swap back to the row's own exercise is not a
// swap and is dropped.
async function validatedSwaps(
  userId: string,
  workoutId: string | null,
  swaps: ExerciseSwaps,
): Promise<ExerciseSwaps> {
  const entries = Object.entries(swaps);
  if (entries.length === 0) return {};
  if (!workoutId) throw new ApiError(400, 'This session has no workout to change.');
  const [rows, exercises] = await Promise.all([
    db.programExercise.findMany({
      where: { workoutId, id: { in: entries.map(([rowId]) => rowId) } },
      select: { id: true, exerciseId: true },
    }),
    db.exercise.findMany({
      where: {
        id: { in: entries.map(([, exerciseId]) => exerciseId) },
        ...usableExerciseWhere(userId),
      },
      select: { id: true },
    }),
  ]);
  const rowExercise = new Map(rows.map((row) => [row.id, row.exerciseId]));
  const usable = new Set(exercises.map((exercise) => exercise.id));
  const normalized: ExerciseSwaps = {};
  for (const [rowId, exerciseId] of entries) {
    if (!rowExercise.has(rowId)) throw new ApiError(400, 'Unknown exercise row in this session.');
    if (!usable.has(exerciseId)) throw new ApiError(400, 'Invalid exercise.');
    if (rowExercise.get(rowId) !== exerciseId) normalized[rowId] = exerciseId;
  }
  return normalized;
}

export async function DELETE(_req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    await db.session.delete({ where: { id: params.id, userId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
