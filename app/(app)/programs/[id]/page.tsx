import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ProgramDetailView } from '@/components/programs/program-detail-view';
import { pickableExerciseWhere } from '@/lib/catalog/access';

interface Props {
  params: Promise<{ id: string }>;
  // `?workout=<id>` opens that workout of the program (the Programas list
  // links each workout here).
  searchParams: Promise<{ workout?: string | string[] }>;
}

export default async function ProgramDetailPage(props: Props) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const session = await requireSession();

  const program = await db.program.findFirst({
    where: { id: params.id, userId: session.userId },
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

  if (!program) notFound();

  const exercisesCatalog = await db.exercise.findMany({
    where: pickableExerciseWhere(session.userId),
    orderBy: [{ muscleGroup: 'asc' }, { name: 'asc' }],
  });

  const requested = Array.isArray(searchParams.workout)
    ? searchParams.workout[0]
    : searchParams.workout;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
      <ProgramDetailView
        program={program}
        catalog={exercisesCatalog}
        initialWorkoutId={requested ?? null}
      />
    </main>
  );
}
