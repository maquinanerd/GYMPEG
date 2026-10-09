import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessionStartSchema } from '@/lib/schemas/session';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { resolveStartedAt } from '@/lib/set-timing';
import { currentProgramRevisionId } from '@/lib/program-revisions';
import { cycleWeekAt, programCycle } from '@/lib/program-cycle';
import { getUserTimeZone } from '@/lib/user-timezone';
import { recordSessionRecommendations } from '@/lib/training-recommendations';
import { Prisma } from '@/prisma/generated/client';
import { log } from '@/lib/log';

export async function GET() {
  try {
    const userId = await requireApiUserId();
    const sessions = await db.session.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      include: {
        workout: { select: { name: true } },
        program: { select: { name: true } },
        _count: { select: { sets: true } },
      },
      take: 50,
    });
    return NextResponse.json(sessions);
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/sessions: starts a new session on one of the user's workouts.
//
// Device-generated id (offline outbox, ADR-004): the start is idempotent. A
// replay returns the stored session. The outbox replay of a start made offline
// always creates the session with that id, because the sets queued on the
// device already point to it.
//
// Live start (`resumeOpen`) or no id (older clients): an unfinished session on
// the same workout is returned instead of a new one (resume after a reload,
// no zombie sessions from a double-click).
export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();
    const { workoutId, gymId, id, startedAt, resumeOpen } = await parseJsonBody(
      req,
      sessionStartSchema,
    );

    if (id) {
      const replay = await existingSessionForId(id, userId);
      if (replay) return NextResponse.json(replay, { status: 200 });
    }

    const workout = await db.workout.findFirst({
      where: { id: workoutId, program: { userId } },
      include: {
        program: { select: { cycleWeeks: true, cycleDeloadWeek: true, cycleAnchor: true } },
      },
    });
    if (!workout) {
      throw new ApiError(404, 'Session not found.');
    }

    let selectedGymId =
      gymId ??
      (await db.user.findUnique({ where: { id: userId }, select: { activeGymId: true } }))
        ?.activeGymId ??
      null;
    if (selectedGymId) {
      const gym = await db.gym.findFirst({
        where: { id: selectedGymId, userId },
        select: { id: true },
      });
      if (!gym) {
        // A start queued offline may name a gym deleted in the meantime: the
        // session is still created, without the gym, so its sets are not lost.
        if (!id) throw new ApiError(400, 'Invalid gym.');
        selectedGymId = null;
      }
    }

    if (!id || resumeOpen) {
      const inProgress = await db.session.findFirst({
        where: { userId, workoutId, finishedAt: null },
      });
      if (inProgress) {
        // We return the existing session instead of creating a new one:
        // allows resuming cleanly after a reload.
        return NextResponse.json(inProgress, { status: 200 });
      }
    }

    // The program version this session runs: the plan as it is right now.
    const programRevisionId = await currentProgramRevisionId(workout.programId);
    // ... and the week of the program's cycle it falls in.
    const sessionStart = resolveStartedAt(startedAt, new Date());
    const cycle = programCycle(workout.program);
    const cycleWeek = cycle
      ? cycleWeekAt(cycle, sessionStart, await getUserTimeZone(userId))
      : null;

    try {
      const created = await db.session.create({
        data: {
          ...(id ? { id } : {}),
          userId,
          workoutId,
          programId: workout.programId,
          programRevisionId,
          cycleWeek,
          gymId: selectedGymId,
          startedAt: sessionStart,
        },
      });
      // The engine's decisions for this session, kept for audit (ADR-007).
      // Best effort: the session exists already, a failure here must not fail
      // the start (the offline outbox would retry it).
      try {
        await recordSessionRecommendations(userId, created.id);
      } catch (recordErr) {
        log.error('sessions.recommendation_record_failed', { err: recordErr });
      }
      return NextResponse.json(created, { status: 201 });
    } catch (err) {
      // Two concurrent starts with the same id (two tabs, a retry racing the
      // original): the loser answers with the winner's row.
      if (id && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const winner = await existingSessionForId(id, userId);
        if (winner) return NextResponse.json(winner, { status: 200 });
      }
      throw err;
    }
  } catch (err) {
    return handleApiError(err);
  }
}

// The session already stored under a device id, or null. An id taken by
// another account is a conflict (UUIDv7 ids are not guessable, so this only
// happens with a forged request).
async function existingSessionForId(id: string, userId: string) {
  const existing = await db.session.findUnique({ where: { id } });
  if (!existing) return null;
  if (existing.userId !== userId) throw new ApiError(409, 'Session id already in use.');
  return existing;
}
