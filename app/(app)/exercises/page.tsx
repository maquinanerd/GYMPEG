import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ExercisesView } from '@/components/exercises/exercises-view';
import { TrainingHeader } from '@/components/nav/screen-header';
import { usableExerciseWhere } from '@/lib/catalog/access';

export default async function ExercisesPage() {
  const session = await requireSession();
  const [exercises, user] = await Promise.all([
    db.exercise.findMany({
      where: usableExerciseWhere(session.userId),
      orderBy: [{ muscleGroup: 'asc' }, { name: 'asc' }],
    }),
    // The active gym's equipment backs the "Só o que tenho" chip.
    db.user.findUnique({
      where: { id: session.userId },
      select: { activeGym: { select: { availableEquipment: true } } },
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1">
      <TrainingHeader />
      <ExercisesView
        exercises={exercises}
        availableEquipment={user?.activeGym?.availableEquipment ?? null}
      />
    </main>
  );
}
