import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import catalog from '@/data/exercise-media.json';
import {
  exerciseMediaApproved,
  exerciseMediaCoverage,
  getExerciseDatasetId,
  getExerciseMedia,
} from './exercise-media';
import { EXERCISE_CATALOG } from './exercise-catalog';
import { exerciseNameDictionaries } from '@/i18n/exercise-names';

describe('exercise media catalog', () => {
  it('maps the default catalog and imported Alpha Progression names to dataset ids', () => {
    const imported = Object.keys(exerciseNameDictionaries.ru ?? {}).filter((name) =>
      name.includes('·'),
    );
    const names = [
      ...EXERCISE_CATALOG.map((exercise) => exercise.name),
      ...imported,
      'Шея зад · Misc',
    ];
    const unmapped = names.filter((name) => getExerciseDatasetId(name) === null);
    expect(unmapped).toEqual([]);
  });

  it('serves no media while the source license is unverified', () => {
    expect(catalog.source.license).toBe('UNVERIFIED');
    expect(exerciseMediaApproved).toBe(false);
    expect(getExerciseMedia('Barbell bench press')).toBeNull();
    expect(exerciseMediaCoverage(['Barbell bench press']).missing).toEqual(['Barbell bench press']);
  });

  it('does not ship image files from an unapproved source', () => {
    const dir = path.join(process.cwd(), 'public', 'exercise-media', catalog.source.id);
    expect(fs.existsSync(dir)).toBe(false);
  });

  it('returns null for an unknown custom exercise', () => {
    expect(getExerciseDatasetId('A future custom movement')).toBeNull();
    expect(getExerciseMedia('A future custom movement')).toBeNull();
  });
});
