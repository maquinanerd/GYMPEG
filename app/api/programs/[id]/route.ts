import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { programInputSchema, type ProgramInput } from '@/lib/schemas/program';
import { anchorForCurrentWeek } from '@/lib/program-cycle';
import { getUserTimeZone } from '@/lib/user-timezone';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { recordProgramRevision } from '@/lib/program-revisions';

interface Params {
  params: Promise<{ id: string }>;
}

// Ownership is enforced by scoping every query with userId (issue #317):
// there is no separate check to delete, so a stranger's id yields 404 via a
// null read or Prisma P2025, which handleApiError maps to 404.

export async function GET(_req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    const program = await db.program.findFirst({
      where: { id: params.id, userId },
      include: {
        workouts: {
          orderBy: { order: 'asc' },
          include: {
            exercises: {
              orderBy: { order: 'asc' },
              include: { exercise: true },
            },
          },
        },
      },
    });
    if (!program) throw new ApiError(404, 'Program not found.');
    return NextResponse.json(program);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    const data = await parseJsonBody(req, programInputSchema);
    const program = await db.program.update({
      where: { id: params.id, userId },
      data: {
        name: data.name,
        phase: data.phase,
        description: data.description ?? null,
        ...(data.scheduleMode ? { scheduleMode: data.scheduleMode } : {}),
        ...(await cycleUpdate(userId, params.id, data)),
      },
    });
    await recordProgramRevision(program.id, { source: 'USER' });
    return NextResponse.json(program);
  } catch (err) {
    return handleApiError(err);
  }
}

// The cycle columns to write: none when the request does not touch the
// cycle, all cleared when it removes it. The anchor moves only when the
// lifter says which week they are in (or the cycle is new).
async function cycleUpdate(userId: string, programId: string, data: ProgramInput) {
  if (data.cycleWeeks === undefined) return {};
  if (data.cycleWeeks === null) {
    return { cycleWeeks: null, cycleDeloadWeek: null, cycleAnchor: null };
  }
  const current = await db.program.findFirst({
    where: { id: programId, userId },
    select: { cycleAnchor: true },
  });
  const timeZone = await getUserTimeZone(userId);
  const cycleAnchor =
    data.cycleCurrentWeek != null || !current?.cycleAnchor
      ? anchorForCurrentWeek(data.cycleCurrentWeek ?? 1, new Date(), timeZone)
      : current.cycleAnchor;
  return {
    cycleWeeks: data.cycleWeeks,
    cycleDeloadWeek: data.cycleDeloadWeek ?? null,
    cycleAnchor,
  };
}

export async function DELETE(_req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    // onDelete: Cascade on Workout removes workouts + programExercises.
    // Linked Sessions have a nullable programId so they will be detached
    // (Prisma sets null by default on optional relations).
    await db.program.delete({ where: { id: params.id, userId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
