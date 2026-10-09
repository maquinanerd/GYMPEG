import { db } from '@/lib/db';
import { ApiError } from '@/lib/api';
import { usableExerciseWhere } from '@/lib/catalog/access';
import type { OnboardingInput } from '@/lib/schemas/onboarding';

// Saves the onboarding answers in one transaction: profile and availability,
// the training gym and its equipment, and the exercises to prefer or avoid.
// Re-running it (the user edits their answers) replaces the previous ones.
export async function saveOnboarding(userId: string, input: OnboardingInput): Promise<void> {
  const trainingDays = [...new Set(input.trainingDays ?? [])].sort((a, b) => a - b);
  const daysPerWeek = input.daysPerWeek ?? (trainingDays.length > 0 ? trainingDays.length : null);

  // AVOID wins when an exercise is in both lists.
  const avoid = [...new Set(input.avoidExerciseIds ?? [])];
  const prefer = [...new Set(input.preferExerciseIds ?? [])].filter((id) => !avoid.includes(id));
  const referenced = [...avoid, ...prefer];
  if (referenced.length > 0) {
    const usable = await db.exercise.count({
      where: { ...usableExerciseWhere(userId), id: { in: referenced } },
    });
    if (usable !== referenced.length) throw new ApiError(400, 'Invalid exercise.');
  }

  await db.$transaction(async (tx) => {
    const now = new Date();
    await tx.user.update({
      where: { id: userId },
      data: {
        goal: input.goal,
        ...(input.experience !== undefined ? { experience: input.experience } : {}),
        weeklyFrequency: daysPerWeek,
        trainingDays,
        ...(input.sessionMinutes !== undefined ? { sessionMinutes: input.sessionMinutes } : {}),
        ...(input.preferredTrainingTime !== undefined
          ? { preferredTrainingTime: input.preferredTrainingTime }
          : {}),
        priorityMuscles: [...new Set(input.priorityMuscles ?? [])],
        ...(input.heightCm !== undefined ? { heightCm: input.heightCm } : {}),
        ...(input.birthDate !== undefined
          ? { birthDate: input.birthDate ? new Date(`${input.birthDate}T00:00:00Z`) : null }
          : {}),
        ...(input.sex !== undefined ? { sex: input.sex } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        onboardedAt: now,
      },
    });

    // A weight given here also starts the bodyweight history, so the trend
    // has its first point (User.bodyweight stays the current value).
    if (input.bodyweight != null) {
      await tx.user.update({ where: { id: userId }, data: { bodyweight: input.bodyweight } });
      await tx.bodyweightEntry.create({
        data: { userId, weightKg: input.bodyweight, measuredAt: now, note: null },
      });
    }

    if (input.gym) {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { activeGymId: true },
      });
      // Edit the active gym when there is one; otherwise reuse a gym with the
      // same name, or create it, and make it active.
      const gym = user.activeGymId
        ? await tx.gym.update({
            where: { id: user.activeGymId },
            data: { availableEquipment: input.gym.availableEquipment },
          })
        : await tx.gym.upsert({
            where: { userId_name: { userId, name: input.gym.name } },
            create: {
              userId,
              name: input.gym.name,
              availableEquipment: input.gym.availableEquipment,
            },
            update: { availableEquipment: input.gym.availableEquipment },
          });
      if (!user.activeGymId) {
        await tx.user.update({ where: { id: userId }, data: { activeGymId: gym.id } });
      }
    }

    await tx.exercisePreference.deleteMany({ where: { userId } });
    if (referenced.length > 0) {
      await tx.exercisePreference.createMany({
        data: [
          ...avoid.map((exerciseId) => ({ userId, exerciseId, kind: 'AVOID' as const })),
          ...prefer.map((exerciseId) => ({ userId, exerciseId, kind: 'PREFER' as const })),
        ],
      });
    }
  });
}

// "Skip for now": the prompt stops showing; answers can be filled later.
export async function skipOnboarding(userId: string): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { onboardedAt: new Date() } });
}
