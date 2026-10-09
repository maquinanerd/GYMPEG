import { describe, expect, it } from 'vitest';
import { onboardingSchema } from './onboarding';

describe('onboardingSchema', () => {
  it('only requires the goal', () => {
    expect(onboardingSchema.safeParse({ goal: 'HYPERTROPHY' }).success).toBe(true);
    expect(onboardingSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a full answer', () => {
    const parsed = onboardingSchema.parse({
      goal: 'RETURN_TO_TRAINING',
      experience: 'BEGINNER',
      daysPerWeek: 3,
      trainingDays: [1, 3, 5],
      sessionMinutes: 45,
      preferredTrainingTime: 'evening',
      gym: { name: 'Academia do condomínio', availableEquipment: ['dumbbell', 'bench'] },
      priorityMuscles: ['CHEST', 'SHOULDERS_LATERAL'],
      avoidExerciseIds: ['ex1'],
      bodyweight: 82.4,
      heightCm: 178,
      birthDate: '1990-05-17',
      sex: null,
      unit: 'KG',
    });
    expect(parsed.gym?.availableEquipment).toEqual(['dumbbell', 'bench']);
  });

  it('rejects out-of-range availability and unknown equipment', () => {
    expect(onboardingSchema.safeParse({ goal: 'STRENGTH', trainingDays: [7] }).success).toBe(false);
    expect(onboardingSchema.safeParse({ goal: 'STRENGTH', sessionMinutes: 600 }).success).toBe(
      false,
    );
    expect(
      onboardingSchema.safeParse({
        goal: 'STRENGTH',
        gym: { name: 'X', availableEquipment: ['jetpack'] },
      }).success,
    ).toBe(false);
  });

  it('validates the birth date as a real date for a plausible age', () => {
    const ok = (birthDate: string) =>
      onboardingSchema.safeParse({ goal: 'STRENGTH', birthDate }).success;
    expect(ok('1990-05-17')).toBe(true);
    expect(ok('1990-02-30')).toBe(false);
    expect(ok('17/05/1990')).toBe(false);
    expect(ok(`${new Date().getUTCFullYear() - 5}-01-01`)).toBe(false);
    expect(ok('1900-01-01')).toBe(false);
  });
});
