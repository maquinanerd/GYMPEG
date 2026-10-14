import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import catalog from '@/data/exercise-media.json';
import globalCatalog from '@/data/catalog/exercises.json';
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

  it('serves the approved source with its declared license and provenance note', () => {
    expect(exerciseMediaApproved).toBe(true);
    expect(catalog.source.license).toBe('Unlicense');
    expect(catalog.source.licenseVerified).toBe(false);
    expect(getExerciseMedia('Barbell bench press')).toEqual({
      datasetId: 'Barbell_Bench_Press_-_Medium_Grip',
      frames: [
        '/exercise-media/free-exercise-db/Barbell_Bench_Press_-_Medium_Grip/0.jpg',
        '/exercise-media/free-exercise-db/Barbell_Bench_Press_-_Medium_Grip/1.jpg',
      ],
      approximate: false,
      source: {
        name: 'free-exercise-db',
        url: 'https://github.com/yuhonas/free-exercise-db',
        license: 'Unlicense',
      },
    });
  });

  it('gives every global catalog exercise its own free-exercise-db reference', () => {
    const wrong = globalCatalog.exercises
      .filter((exercise) => exercise.sourceRef)
      .flatMap((exercise) =>
        [exercise.name, ...exercise.legacyNames].map((name) => ({ name, exercise })),
      )
      .filter(({ name, exercise }) => {
        const media = getExerciseMedia(name);
        return media?.datasetId !== exercise.sourceRef || media.approximate;
      })
      .map(({ name }) => name);
    expect(wrong).toEqual([]);
  });

  it('ships both frames of every mapped exercise', () => {
    const root = path.join(process.cwd(), 'public', 'exercise-media', catalog.source.id);
    const missing = catalog.groups
      .flatMap((group) => ['0.jpg', '1.jpg'].map((frame) => path.join(group.datasetId, frame)))
      .filter((frame) => !fs.existsSync(path.join(root, frame)));
    expect(missing).toEqual([]);
    expect(exerciseMediaCoverage(['Barbell bench press']).covered).toEqual(['Barbell bench press']);
  });

  it('returns null for an unknown custom exercise', () => {
    expect(getExerciseDatasetId('A future custom movement')).toBeNull();
    expect(getExerciseMedia('A future custom movement')).toBeNull();
  });
});
