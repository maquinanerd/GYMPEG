import { describe, expect, it } from 'vitest';
import {
  buildProgramSnapshot,
  canonicalJson,
  diffProgramSnapshots,
  isEmptyDiff,
  programSnapshotSchema,
  snapshotContent,
  type ProgramForSnapshot,
  type ProgramSnapshot,
} from './program-snapshot';

type Row = ProgramForSnapshot['workouts'][number]['exercises'][number];

function pe(
  id: string,
  exerciseId: string,
  name: string,
  order: number,
  extra: Partial<Row> = {},
): Row {
  return {
    id,
    exerciseId,
    exercise: { name },
    order,
    targetSets: 3,
    targetRepsMin: 8,
    targetRepsMax: 12,
    targetRIR: 2,
    restSec: 120,
    tempo: null,
    notes: null,
    supersetGroup: null,
    autoregulationMode: 'PRESERVE_RIR',
    fatigueRate: null,
    loadAdjustmentPct: null,
    ...extra,
  };
}

function program(overrides: Partial<ProgramForSnapshot> = {}): ProgramForSnapshot {
  return {
    name: 'Hypertrophy',
    description: null,
    phase: 'Base',
    scheduleMode: 'ROTATION',
    workouts: [
      {
        id: 'w-upper',
        name: 'Upper',
        dayOfWeek: 1,
        order: 1,
        exercises: [pe('pe-bench', 'ex-bench', 'Bench press', 1), pe('pe-row', 'ex-row', 'Row', 2)],
      },
      {
        id: 'w-lower',
        name: 'Lower',
        dayOfWeek: 3,
        order: 2,
        exercises: [pe('pe-squat', 'ex-squat', 'Squat', 1)],
      },
    ],
    ...overrides,
  };
}

const base = (): ProgramSnapshot => buildProgramSnapshot(program());

function edit(mutate: (snapshot: ProgramSnapshot) => void): ProgramSnapshot {
  const copy = structuredClone(base());
  mutate(copy);
  return copy;
}

describe('buildProgramSnapshot', () => {
  it('orders workouts and prescriptions and keeps the exercise names', () => {
    const shuffled = program();
    shuffled.workouts.reverse();
    shuffled.workouts[1]!.exercises.reverse();

    const snapshot = buildProgramSnapshot(shuffled);

    expect(snapshot.workouts.map((workout) => workout.name)).toEqual(['Upper', 'Lower']);
    expect(snapshot.workouts[0]!.exercises.map((item) => item.exerciseName)).toEqual([
      'Bench press',
      'Row',
    ]);
  });
});

describe('snapshotContent', () => {
  it('ignores row ids and exercise display names', () => {
    const renamedRows = edit((snapshot) => {
      snapshot.workouts[0]!.id = 'w-new';
      snapshot.workouts[0]!.exercises[0]!.id = 'pe-new';
      snapshot.workouts[0]!.exercises[0]!.exerciseName = 'Supino reto';
    });

    expect(snapshotContent(renamedRows)).toBe(snapshotContent(base()));
  });

  it('changes with any prescription value', () => {
    const heavier = edit((snapshot) => {
      snapshot.workouts[0]!.exercises[0]!.targetRepsMin = 6;
    });

    expect(snapshotContent(heavier)).not.toBe(snapshotContent(base()));
  });

  it('keeps the hash of versions recorded before schedules existed', () => {
    const legacy = programSnapshotSchema.parse({ ...base(), scheduleMode: undefined });
    expect(legacy.scheduleMode).toBe('ROTATION');
    expect(snapshotContent(legacy)).toBe(snapshotContent(base()));
    const byDays = edit((snapshot) => {
      snapshot.scheduleMode = 'FIXED_DAYS';
    });
    expect(snapshotContent(byDays)).not.toBe(snapshotContent(base()));
    expect(diffProgramSnapshots(base(), byDays).fields).toEqual([
      { field: 'scheduleMode', from: 'ROTATION', to: 'FIXED_DAYS' },
    ]);
  });

  it('does not depend on key order (JSONB reorders keys)', () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: null }] })).toBe(
      canonicalJson({ a: [{ c: null, d: 2 }], b: 1 }),
    );
  });
});

describe('diffProgramSnapshots', () => {
  it('reports nothing between identical versions', () => {
    expect(isEmptyDiff(diffProgramSnapshots(base(), base()))).toBe(true);
  });

  it('reports program fields, added and removed workouts', () => {
    const next = edit((snapshot) => {
      snapshot.name = 'Strength';
      snapshot.workouts = snapshot.workouts.filter((workout) => workout.name !== 'Lower');
      snapshot.workouts.push({
        id: 'w-full',
        name: 'Full body',
        dayOfWeek: 5,
        order: 3,
        exercises: [{ ...snapshot.workouts[0]!.exercises[0]!, id: 'pe-full-bench' }],
      });
    });

    const diff = diffProgramSnapshots(base(), next);

    expect(diff.fields).toEqual([{ field: 'name', from: 'Hypertrophy', to: 'Strength' }]);
    expect(diff.workoutsRemoved).toEqual(['Lower']);
    expect(diff.workoutsAdded).toEqual([{ name: 'Full body', exercises: ['Bench press'] }]);
  });

  it('reports prescription changes, swaps, additions, removals and reordering', () => {
    const next = edit((snapshot) => {
      const upper = snapshot.workouts[0]!;
      upper.name = 'Upper A';
      upper.exercises[0]!.targetSets = 4;
      upper.exercises[1]!.exerciseId = 'ex-pulldown';
      upper.exercises[1]!.exerciseName = 'Lat pulldown';
      upper.exercises[0]!.order = 2;
      upper.exercises[1]!.order = 1;
      const lower = snapshot.workouts[1]!;
      lower.exercises.push({
        ...lower.exercises[0]!,
        id: 'pe-rdl',
        exerciseId: 'ex-rdl',
        exerciseName: 'RDL',
        order: 2,
      });
    });

    const diff = diffProgramSnapshots(base(), next);

    const upper = diff.workoutsChanged.find((workout) => workout.name === 'Upper A')!;
    expect(upper.previousName).toBe('Upper');
    expect(upper.reordered).toBe(true);
    expect(upper.exercisesChanged).toEqual([
      { name: 'Bench press', fields: [{ field: 'targetSets', from: 3, to: 4 }] },
      { name: 'Lat pulldown', previousName: 'Row', fields: [] },
    ]);
    const lower = diff.workoutsChanged.find((workout) => workout.name === 'Lower')!;
    expect(lower.exercisesAdded).toEqual(['RDL']);
    expect(lower.reordered).toBe(false);
  });

  it('matches re-created rows by workout name and exercise', () => {
    const recreated = edit((snapshot) => {
      snapshot.workouts[1]!.id = 'w-lower-restored';
      snapshot.workouts[1]!.exercises[0]!.id = 'pe-squat-restored';
    });

    expect(isEmptyDiff(diffProgramSnapshots(base(), recreated))).toBe(true);
  });

  it('treats an exercise merged into the catalog (same name, new id) as unchanged', () => {
    const merged = edit((snapshot) => {
      snapshot.workouts[1]!.exercises[0]!.exerciseId = 'ex-catalog-squat';
    });

    expect(isEmptyDiff(diffProgramSnapshots(base(), merged))).toBe(true);
  });
});
