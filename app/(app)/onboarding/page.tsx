import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { pickableExerciseWhere } from '@/lib/catalog/access';
import { TRAINING_TIMES } from '@/lib/schemas/onboarding';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';

export default async function OnboardingPage() {
  const t = await getTranslations('onboarding');
  const auth = await requireSession();

  const [user, exercises, avoided] = await Promise.all([
    db.user.findUnique({
      where: { id: auth.userId },
      select: {
        goal: true,
        experience: true,
        weeklyFrequency: true,
        trainingDays: true,
        sessionMinutes: true,
        preferredTrainingTime: true,
        priorityMuscles: true,
        bodyweight: true,
        heightCm: true,
        birthDate: true,
        sex: true,
        unit: true,
        activeGym: { select: { name: true, availableEquipment: true } },
      },
    }),
    db.exercise.findMany({
      where: pickableExerciseWhere(auth.userId),
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    db.exercisePreference.findMany({
      where: { userId: auth.userId, kind: 'AVOID' },
      select: { exerciseId: true },
    }),
  ]);

  const time = user?.preferredTrainingTime;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 pt-6">
      <h1 className="text-title">{t('title')}</h1>
      <OnboardingFlow
        exercises={exercises}
        initial={{
          goal: user?.goal ?? null,
          experience: user?.experience ?? null,
          daysPerWeek: user?.weeklyFrequency ?? null,
          trainingDays: user?.trainingDays ?? [],
          sessionMinutes: user?.sessionMinutes ?? null,
          preferredTrainingTime:
            time && (TRAINING_TIMES as readonly string[]).includes(time)
              ? (time as (typeof TRAINING_TIMES)[number])
              : null,
          gymName: user?.activeGym?.name ?? null,
          availableEquipment: user?.activeGym?.availableEquipment ?? [],
          priorityMuscles: user?.priorityMuscles ?? [],
          avoidExerciseIds: avoided.map((a) => a.exerciseId),
          bodyweightKg: user?.bodyweight ?? null,
          heightCm: user?.heightCm ?? null,
          birthDate: user?.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
          sex: user?.sex ?? null,
          unit: user?.unit ?? 'KG',
        }}
      />
    </main>
  );
}
