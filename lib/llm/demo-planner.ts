// Demo answer of the AI workout planner (LLM_PROVIDER=demo): a deterministic
// plan built from the candidates the planner offered, so the generate ->
// preview -> save flow works end to end without an API key. It follows the
// same contract as a real model (exerciseId only, one JSON object).

import type { MuscleGroup } from '@/lib/prisma-client';
import { estimateWorkoutMinutes } from '@/lib/ai/workout-plan';

interface DemoCandidate {
  id: string;
  primaryMuscles: MuscleGroup[];
  category: string;
}

interface DemoPayload {
  locale?: string;
  context?: {
    availability?: {
      sessionsPerWeek?: number | null;
      sessionMinutes?: number | null;
      trainingDays?: number[];
    };
  };
  candidates?: DemoCandidate[];
}

type Slot = MuscleGroup[];

const FULL_BODY: Slot[] = [
  ['QUADS'],
  ['CHEST'],
  ['BACK_WIDTH', 'BACK_THICKNESS'],
  ['HAMSTRINGS', 'GLUTES'],
  ['SHOULDERS_LATERAL', 'SHOULDERS_FRONT'],
  ['BICEPS', 'TRICEPS'],
];
const UPPER: Slot[] = [
  ['CHEST'],
  ['BACK_WIDTH'],
  ['SHOULDERS_FRONT', 'CHEST'],
  ['BACK_THICKNESS', 'BACK_WIDTH'],
  ['SHOULDERS_LATERAL'],
  ['BICEPS'],
  ['TRICEPS'],
];
const LOWER: Slot[] = [['QUADS'], ['HAMSTRINGS'], ['GLUTES', 'QUADS'], ['CALVES'], ['ABS']];
const PUSH: Slot[] = [['CHEST'], ['SHOULDERS_FRONT'], ['SHOULDERS_LATERAL'], ['TRICEPS']];
const PULL: Slot[] = [['BACK_WIDTH'], ['BACK_THICKNESS'], ['SHOULDERS_REAR'], ['BICEPS']];
const LEGS: Slot[] = [['QUADS'], ['GLUTES', 'HAMSTRINGS'], ['HAMSTRINGS'], ['CALVES']];

const NAMES = {
  pt: {
    full: 'Corpo inteiro',
    upper: 'Superiores',
    lower: 'Inferiores',
    push: 'Empurrar',
    pull: 'Puxar',
    legs: 'Pernas',
    title: (n: number) => `Plano de ${n} dias (demo)`,
    rationale:
      'Plano de demonstração montado só com os exercícios disponíveis na sua academia: compostos primeiro, 3 séries por exercício a 2 repetições da falha e descanso maior nos multiarticulares. Configure um provedor de IA para um plano personalizado.',
  },
  en: {
    full: 'Full body',
    upper: 'Upper',
    lower: 'Lower',
    push: 'Push',
    pull: 'Pull',
    legs: 'Legs',
    title: (n: number) => `${n}-day plan (demo)`,
    rationale:
      'Demo plan built only from the exercises your gym has: compounds first, 3 sets per exercise 2 reps short of failure and longer rest on multi-joint lifts. Set up an AI provider for a personalised plan.',
  },
};

type Names = (typeof NAMES)['en'];

function split(sessions: number, names: Names): { name: string; slots: Slot[] }[] {
  const letter = (i: number) => String.fromCharCode(65 + i);
  if (sessions <= 3) {
    return Array.from({ length: sessions }, (_, i) => ({
      name: `${names.full} ${letter(i)}`,
      slots: FULL_BODY,
    }));
  }
  if (sessions === 4) {
    return [
      { name: `${names.upper} A`, slots: UPPER },
      { name: `${names.lower} A`, slots: LOWER },
      { name: `${names.upper} B`, slots: UPPER },
      { name: `${names.lower} B`, slots: LOWER },
    ];
  }
  return [
    { name: names.upper, slots: UPPER },
    { name: names.lower, slots: LOWER },
    { name: names.push, slots: PUSH },
    { name: names.pull, slots: PULL },
    { name: names.legs, slots: LEGS },
  ];
}

export function demoWorkoutPlan(payloadText: string): string {
  let payload: DemoPayload = {};
  try {
    payload = JSON.parse(payloadText) as DemoPayload;
  } catch {
    // An unreadable payload still gets a (small) valid answer below.
  }
  const names = payload.locale?.toLowerCase().startsWith('pt') ? NAMES.pt : NAMES.en;
  const candidates = payload.candidates ?? [];
  const availability = payload.context?.availability ?? {};
  const sessions = Math.min(5, Math.max(2, availability.sessionsPerWeek ?? 3));
  const days = availability.trainingDays ?? [];
  const sessionMinutes = availability.sessionMinutes ?? null;

  // How often each candidate was picked, so repeated workouts vary.
  const uses = new Map<string, number>();
  const workouts = split(sessions, names).map((template, w) => {
    const picked: DemoCandidate[] = [];
    for (const slot of template.slots) {
      const options = candidates
        .filter((c) => c.primaryMuscles.some((m) => slot.includes(m)))
        .filter((c) => !picked.includes(c));
      if (options.length === 0) continue;
      const choice = [...options].sort((a, b) => (uses.get(a.id) ?? 0) - (uses.get(b.id) ?? 0))[0]!;
      uses.set(choice.id, (uses.get(choice.id) ?? 0) + 1);
      picked.push(choice);
    }
    let exercises = picked.map((candidate, i) => {
      const compound = candidate.category === 'COMPOUND';
      return {
        exerciseId: candidate.id,
        order: i + 1,
        sets: 3,
        repMin: compound ? 6 : 10,
        repMax: compound ? 10 : 15,
        targetRir: 2,
        targetRpe: null,
        restSeconds: compound ? 150 : 75,
      };
    });
    // Trim accessories until the workout fits the session (keep at least 3).
    while (
      sessionMinutes != null &&
      exercises.length > 3 &&
      estimateWorkoutMinutes(exercises) > sessionMinutes
    ) {
      exercises = exercises.slice(0, -1);
    }
    return {
      name: template.name,
      dayOfWeek: days.length === sessions ? days[w]! : null,
      estimatedDurationMinutes: estimateWorkoutMinutes(exercises),
      exercises,
    };
  });

  const usable = workouts.filter((workout) => workout.exercises.length > 0);
  return JSON.stringify({
    title: names.title(usable.length),
    rationale: names.rationale,
    daysPerWeek: usable.length,
    workouts: usable,
  });
}
