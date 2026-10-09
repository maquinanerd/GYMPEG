import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, requireApiUserId } from '@/lib/api';
import { liveSessionGymInclude } from '@/lib/session-gym-selection';
import { getUserTimeZone } from '@/lib/user-timezone';
import {
  loadRunnerProfile,
  loadWorkoutContext,
  runnerWorkoutInclude,
} from '@/lib/session-runner-data';

// GET /api/session-pack: everything the session runner needs to start and
// run any workout of the active program without a network (ADR-004). The
// device stores it in IndexedDB (lib/training-pack) and refreshes it while
// online. Never cached by the service worker: it is health data, kept only
// in the account's own IndexedDB record and dropped on logout.
export async function GET() {
  try {
    const userId = await requireApiUserId();
    const pack = await buildSessionPack(userId, new Date());
    return NextResponse.json(pack, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

export type SessionPack = Awaited<ReturnType<typeof buildSessionPack>>;

async function buildSessionPack(userId: string, now: Date) {
  const [profile, program, gyms] = await Promise.all([
    loadRunnerProfile(userId, now),
    db.program.findFirst({
      where: { userId, isActive: true },
      select: {
        id: true,
        name: true,
        workouts: { orderBy: { order: 'asc' }, include: runnerWorkoutInclude },
      },
    }),
    db.gym.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: liveSessionGymInclude,
    }),
  ]);
  const activeGym = gyms.find((gym) => gym.id === profile.activeGymId) ?? null;

  const workouts = await Promise.all(
    (program?.workouts ?? []).map(async (workout) => ({
      workout,
      ...(await loadWorkoutContext(userId, {
        programExercises: workout.exercises,
        excludeSessionId: null,
        now,
        bodyweight: profile.bodyweight,
        gym: activeGym,
      })),
    })),
  );

  return {
    generatedAt: now.toISOString(),
    // For the week of the program's cycle a session started offline is in.
    timeZone: await getUserTimeZone(userId),
    program: program ? { id: program.id, name: program.name } : null,
    unit: profile.unit,
    deloadActive: profile.deloadActive,
    readiness: profile.readiness,
    activeGymId: profile.activeGymId,
    catalog: profile.catalog,
    gyms,
    workouts,
  };
}
