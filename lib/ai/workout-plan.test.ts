import { describe, expect, it } from 'vitest';
import type { PlannerCandidate } from './exercise-retrieval';
import {
  estimateWorkoutMinutes,
  parseAiWorkoutPlan,
  validateWorkoutPlan,
  type AiWorkoutPlan,
} from './workout-plan';

const candidate = (
  id: string,
  primaryMuscles: PlannerCandidate['primaryMuscles'],
  equipment: string[] = [],
): PlannerCandidate => ({
  id,
  name: id,
  primaryMuscles,
  secondaryMuscles: [],
  equipment,
  equipmentType: 'BARBELL',
  movementPattern: null,
  category: 'COMPOUND',
});

const candidates = new Map(
  [
    candidate('bench', ['CHEST'], ['barbell', 'bench']),
    candidate('row', ['BACK_THICKNESS'], ['barbell']),
    candidate('ohp', ['SHOULDERS_FRONT'], ['barbell']),
    candidate('squat', ['QUADS'], ['barbell', 'rack']),
    candidate('rdl', ['HAMSTRINGS'], ['barbell']),
    candidate('leg-press', ['QUADS'], ['leg_press']),
  ].map((c) => [c.id, c]),
);

const exercise = (
  exerciseId: string,
  extra: Partial<AiWorkoutPlan['workouts'][0]['exercises'][0]> = {},
) => ({
  exerciseId,
  order: 1,
  sets: 3,
  repMin: 6,
  repMax: 10,
  targetRir: 2,
  targetRpe: null,
  restSeconds: 120,
  ...extra,
});

const plan = (workouts: AiWorkoutPlan['workouts']): AiWorkoutPlan => ({
  title: 'Upper/Lower',
  rationale: 'Two full sessions.',
  daysPerWeek: workouts.length,
  workouts,
});

const context = {
  candidates,
  availableEquipment: ['barbell', 'bench', 'rack'],
  avoidedIds: new Set<string>(),
  sessionsPerWeek: 2,
  sessionMinutes: 60,
};

const good = plan([
  {
    name: 'Upper',
    estimatedDurationMinutes: 50,
    exercises: [exercise('bench'), exercise('row', { order: 2 }), exercise('ohp', { order: 3 })],
  },
  {
    name: 'Lower',
    estimatedDurationMinutes: 50,
    exercises: [exercise('squat'), exercise('rdl', { order: 2 })],
  },
]);

describe('parseAiWorkoutPlan', () => {
  it('accepts the JSON object, also inside a code fence, and rejects anything else', () => {
    expect(parseAiWorkoutPlan(JSON.stringify(good)).ok).toBe(true);
    expect(parseAiWorkoutPlan('```json\n' + JSON.stringify(good) + '\n```').ok).toBe(true);
    expect(parseAiWorkoutPlan('Here is your plan!').ok).toBe(false);
    const named = JSON.parse(JSON.stringify(good));
    delete named.workouts[0].exercises[0].exerciseId;
    named.workouts[0].exercises[0].exercise = 'Supino mágico inclinado';
    expect(parseAiWorkoutPlan(JSON.stringify(named))).toMatchObject({ ok: false });
  });
});

describe('validateWorkoutPlan', () => {
  it('accepts a sound plan and computes its analysis', () => {
    const result = validateWorkoutPlan(good, context);
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.analysis.weeklySetsByMuscle).toEqual({
      CHEST: 3,
      BACK_THICKNESS: 3,
      SHOULDERS_FRONT: 3,
      QUADS: 3,
      HAMSTRINGS: 3,
    });
    expect(result.analysis.estimatedMinutes).toEqual([
      estimateWorkoutMinutes(good.workouts[0]!.exercises),
      estimateWorkoutMinutes(good.workouts[1]!.exercises),
    ]);
  });

  it('refuses ids it did not offer, avoided exercises and missing equipment', () => {
    const bad = plan([
      {
        name: 'Day',
        estimatedDurationMinutes: 40,
        exercises: [
          exercise('made-up'),
          exercise('leg-press', { order: 2 }),
          exercise('bench', { order: 3 }),
        ],
      },
    ]);
    const result = validateWorkoutPlan(bad, {
      ...context,
      sessionsPerWeek: 1,
      avoidedIds: new Set(['bench']),
    });
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.code)).toEqual([
      'UNKNOWN_EXERCISE',
      'EQUIPMENT_MISSING',
      'AVOIDED_EXERCISE',
    ]);
  });

  it('refuses absurd values, duplicates and a day count that does not add up', () => {
    const bad: AiWorkoutPlan = {
      ...plan([
        {
          name: 'Day',
          estimatedDurationMinutes: 40,
          exercises: [
            exercise('bench', {
              sets: 15,
              repMin: 12,
              repMax: 8,
              targetRir: 7,
              targetRpe: 11,
              restSeconds: 5,
            }),
            exercise('bench', { order: 2 }),
          ],
        },
      ]),
      daysPerWeek: 3,
    };
    expect(validateWorkoutPlan(bad, context).errors.map((e) => e.code)).toEqual([
      'DAYS_MISMATCH',
      'SETS_OUT_OF_RANGE',
      'REPS_OUT_OF_RANGE',
      'RIR_OUT_OF_RANGE',
      'RPE_OUT_OF_RANGE',
      'REST_OUT_OF_RANGE',
      'DUPLICATE_EXERCISE',
    ]);
  });

  it('warns about length, availability, uncovered muscles and runaway volume', () => {
    const long = plan([
      {
        name: 'Push',
        estimatedDurationMinutes: 45,
        exercises: [
          exercise('bench', { sets: 10, restSeconds: 300 }),
          exercise('ohp', { order: 2, sets: 10 }),
        ],
      },
      {
        name: 'Push again',
        estimatedDurationMinutes: 45,
        exercises: [exercise('bench', { sets: 10 }), exercise('ohp', { order: 2, sets: 10 })],
      },
      {
        name: 'Push once more',
        estimatedDurationMinutes: 45,
        exercises: [exercise('bench', { sets: 10 })],
      },
    ]);
    const codes = validateWorkoutPlan(long, context).warnings.map((w) => w.code);
    expect(codes).toContain('SESSIONS_DIFFER_FROM_AVAILABILITY');
    expect(codes).toContain('TOO_LONG');
    expect(codes).toContain('VOLUME_TOO_HIGH');
    expect(codes).toContain('MUSCLE_NOT_COVERED');
  });
});
