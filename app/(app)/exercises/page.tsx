import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ExercisesView } from '@/components/exercises/exercises-view';
import { TrainingHeader } from '@/components/nav/screen-header';
import { usableExerciseWhere } from '@/lib/catalog/access';

export default async function ExercisesPage() {
  const session = await requireSession();
  const exercises = await db.exercise.findMany({
    where: usableExerciseWhere(session.userId),
    orderBy: [{ muscleGroup: 'asc' }, { name: 'asc' }],
  });

  return (
    <main className="flex-1">
      <TrainingHeader />
      <div className="px-4 py-6">
        <ExercisesView exercises={exercises} />
      </div>
    </main>
  );
}
