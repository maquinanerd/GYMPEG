import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { SessionRunner } from '@/components/session/session-runner';
import { LocalSessionRunner } from '@/components/session/local-session-runner';
import { liveSessionGymInclude } from '@/lib/session-gym-selection';
import { usableExerciseWhere } from '@/lib/catalog/access';
import { applyExerciseSwaps, parseExerciseSwaps } from '@/lib/session-swaps';
import {
  loadRunnerProfile,
  loadWorkoutContext,
  runnerWorkoutInclude,
} from '@/lib/session-runner-data';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ programExerciseId?: string }>;
}

export default async function SessionRunPage(props: Props) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const auth = await requireSession();

  const session = await db.session.findFirst({
    where: { id: params.id, userId: auth.userId },
    include: {
      workout: { include: runnerWorkoutInclude },
      sets: { orderBy: [{ exerciseId: 'asc' }, { setNumber: 'asc' }] },
      gym: { include: liveSessionGymInclude },
    },
  });

  if (!session) {
    // A session started on this device whose start has not reached the
    // server yet (flaky network at the gym): the device runs it from its
    // training pack, and shows "not found" when it does not know it either.
    return (
      <LocalSessionRunner
        sessionId={params.id}
        initialProgramExerciseId={searchParams.programExerciseId}
      />
    );
  }
  if (session.finishedAt) {
    // Session already finished: redirect to home. In LOT 8 we will point
    // to the session history page.
    redirect('/');
  }
  if (!session.workout) notFound();

  // Exercises replaced only for this session take their row's place, so the
  // last-time values and suggestions follow the exercise actually done.
  const swaps = parseExerciseSwaps(session.exerciseSwaps);
  const swapIds = Object.values(swaps);
  const swappedExercises =
    swapIds.length > 0
      ? await db.exercise.findMany({
          where: { id: { in: swapIds }, ...usableExerciseWhere(auth.userId) },
        })
      : [];
  const workout = {
    ...session.workout,
    exercises: applyExerciseSwaps(
      session.workout.exercises,
      swaps,
      new Map(swappedExercises.map((exercise) => [exercise.id, exercise])),
    ),
  };

  const now = new Date();
  const profile = await loadRunnerProfile(auth.userId, now);
  const context = await loadWorkoutContext(auth.userId, {
    programExercises: workout.exercises,
    excludeSessionId: session.id,
    now: session.startedAt,
    bodyweight: profile.bodyweight,
    gym: session.gym,
  });

  return (
    <SessionRunner
      session={{ ...session, workout }}
      lastPerformances={context.lastPerformances}
      returnRecommendations={context.returnRecommendations}
      readiness={profile.readiness}
      deloadActive={profile.deloadActive}
      unit={profile.unit}
      initialProgramExerciseId={searchParams.programExerciseId}
      catalog={profile.catalog}
    />
  );
}
