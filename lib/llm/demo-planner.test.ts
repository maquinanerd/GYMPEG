import { describe, expect, it } from 'vitest';
import type { PlannerCandidate } from '@/lib/ai/exercise-retrieval';
import { parseAiWorkoutPlan, validateWorkoutPlan } from '@/lib/ai/workout-plan';
import { demoWorkoutPlan } from './demo-planner';

const candidate = (
  id: string,
  primary: PlannerCandidate['primaryMuscles'],
  category: PlannerCandidate['category'] = 'COMPOUND',
): PlannerCandidate => ({
  id,
  name: id,
  primaryMuscles: primary,
  secondaryMuscles: [],
  equipment: [],
  equipmentType: 'BARBELL',
  movementPattern: null,
  category,
});

const CANDIDATES: PlannerCandidate[] = [
  candidate('squat', ['QUADS']),
  candidate('leg-press', ['QUADS']),
  candidate('bench', ['CHEST']),
  candidate('incline', ['CHEST']),
  candidate('row', ['BACK_THICKNESS']),
  candidate('pulldown', ['BACK_WIDTH']),
  candidate('rdl', ['HAMSTRINGS']),
  candidate('hip-thrust', ['GLUTES']),
  candidate('ohp', ['SHOULDERS_FRONT']),
  candidate('lateral', ['SHOULDERS_LATERAL'], 'ISOLATION'),
  candidate('face-pull', ['SHOULDERS_REAR'], 'ISOLATION'),
  candidate('curl', ['BICEPS'], 'ISOLATION'),
  candidate('pushdown', ['TRICEPS'], 'ISOLATION'),
  candidate('calf', ['CALVES'], 'ISOLATION'),
  candidate('crunch', ['ABS'], 'ISOLATION'),
];

function validate(text: string, sessionsPerWeek: number | null, sessionMinutes: number | null) {
  const parsed = parseAiWorkoutPlan(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return {
    plan: parsed.plan,
    validation: validateWorkoutPlan(parsed.plan, {
      candidates: new Map(CANDIDATES.map((c) => [c.id, c])),
      availableEquipment: [],
      avoidedIds: new Set(),
      sessionsPerWeek,
      sessionMinutes,
    }),
  };
}

describe('demoWorkoutPlan', () => {
  it.each([2, 3, 4, 5])('builds a valid %i-day plan from the candidates only', (sessions) => {
    const { plan, validation } = validate(
      demoWorkoutPlan(
        JSON.stringify({
          locale: 'pt-BR',
          context: { availability: { sessionsPerWeek: sessions, sessionMinutes: 75 } },
          candidates: CANDIDATES,
        }),
      ),
      sessions,
      75,
    );
    expect(validation.errors).toEqual([]);
    expect(plan.workouts).toHaveLength(sessions);
    expect(validation.analysis.missingMajorGroups).toEqual([]);
    expect(plan.title).toContain('demo');
  });

  it('follows the training days and trims workouts to the session length', () => {
    const { plan, validation } = validate(
      demoWorkoutPlan(
        JSON.stringify({
          locale: 'en',
          context: {
            availability: { sessionsPerWeek: 3, sessionMinutes: 30, trainingDays: [1, 3, 5] },
          },
          candidates: CANDIDATES,
        }),
      ),
      3,
      30,
    );
    expect(plan.workouts.map((w) => w.dayOfWeek)).toEqual([1, 3, 5]);
    expect(plan.workouts[0]!.name).toBe('Full body A');
    expect(validation.warnings.filter((w) => w.code === 'TOO_LONG')).toEqual([]);
  });

  it('varies the exercises between repeated workouts', () => {
    const { plan } = validate(
      demoWorkoutPlan(
        JSON.stringify({
          context: { availability: { sessionsPerWeek: 2 } },
          candidates: CANDIDATES,
        }),
      ),
      2,
      null,
    );
    const ids = plan.workouts.map((w) => w.exercises.map((e) => e.exerciseId));
    expect(ids[0]).not.toEqual(ids[1]);
  });
});
