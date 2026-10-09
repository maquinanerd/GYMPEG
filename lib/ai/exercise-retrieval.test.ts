import { describe, expect, it } from 'vitest';
import {
  exerciseFitsEquipment,
  selectCandidates,
  type CatalogExerciseRow,
} from './exercise-retrieval';

const row = (overrides: Partial<CatalogExerciseRow> & { id: string }): CatalogExerciseRow => ({
  name: overrides.id,
  userId: null,
  muscleGroup: 'CHEST',
  category: 'COMPOUND',
  equipmentType: 'BARBELL',
  equipmentTags: ['barbell', 'bench'],
  movementPattern: 'HORIZONTAL_PUSH',
  level: 'INTERMEDIATE',
  muscles: [],
  ...overrides,
});

const base = {
  availableEquipment: [] as string[],
  avoidedIds: new Set<string>(),
  preferredIds: new Set<string>(),
  priorityMuscles: [] as CatalogExerciseRow['muscleGroup'][],
};

describe('exerciseFitsEquipment', () => {
  it('needs every tag, and an unknown gym rules nothing out', () => {
    expect(exerciseFitsEquipment(['barbell', 'bench'], ['barbell', 'bench', 'rack'])).toBe(true);
    expect(exerciseFitsEquipment(['barbell', 'bench'], ['dumbbell', 'bench'])).toBe(false);
    expect(exerciseFitsEquipment(['leg_press'], [])).toBe(true);
    expect(exerciseFitsEquipment([], ['dumbbell'])).toBe(true);
  });
});

describe('selectCandidates', () => {
  const catalog = [
    row({ id: 'bench' }),
    row({ id: 'db-press', equipmentTags: ['dumbbell', 'bench'], equipmentType: 'DUMBBELL' }),
    row({ id: 'fly', category: 'ISOLATION', equipmentTags: ['cable'] }),
    row({ id: 'squat', muscleGroup: 'QUADS', equipmentTags: ['barbell', 'rack'] }),
    row({
      id: 'leg-press',
      muscleGroup: 'QUADS',
      equipmentTags: ['leg_press'],
      equipmentType: 'MACHINE',
    }),
    row({ id: 'run', category: 'CARDIO', muscleGroup: 'OTHER', equipmentTags: [] }),
    row({ id: 'snatch', level: 'ADVANCED', muscleGroup: 'QUADS', equipmentTags: ['barbell'] }),
  ];

  it('keeps only what the gym allows, no cardio, nothing avoided', () => {
    const ids = selectCandidates(catalog, {
      ...base,
      availableEquipment: ['barbell', 'bench', 'rack', 'dumbbell'],
      avoidedIds: new Set(['db-press']),
    }).map((c) => c.id);
    expect(ids).toEqual(['bench', 'snatch', 'squat']);
  });

  it('puts priority muscles first, preferred and compound exercises first, advanced last', () => {
    const ids = selectCandidates(catalog, {
      ...base,
      priorityMuscles: ['QUADS'],
      preferredIds: new Set(['fly']),
      level: 'INTERMEDIATE',
    }).map((c) => c.id);
    expect(ids).toEqual(['leg-press', 'squat', 'snatch', 'fly', 'bench', 'db-press']);
  });

  it('caps each group and the total', () => {
    expect(selectCandidates(catalog, { ...base, perGroup: 1 }).map((c) => c.id)).toEqual([
      'bench',
      'leg-press',
    ]);
    expect(selectCandidates(catalog, { ...base, limit: 2 })).toHaveLength(2);
  });

  it('describes each candidate with its muscles and equipment', () => {
    const [candidate] = selectCandidates(
      [
        row({
          id: 'bench',
          muscles: [
            { role: 'PRIMARY', group: 'CHEST' },
            { role: 'SECONDARY', group: 'TRICEPS' },
            { role: 'STABILIZER', group: 'ABS' },
          ],
        }),
      ],
      base,
    );
    expect(candidate).toMatchObject({
      primaryMuscles: ['CHEST'],
      secondaryMuscles: ['TRICEPS'],
      equipment: ['barbell', 'bench'],
    });
  });
});
