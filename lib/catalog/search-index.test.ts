import { describe, expect, it } from 'vitest';
import exercisesJson from '@/data/catalog/exercises.json';
import searchIndex from '@/data/catalog/search-index.json';
import { buildSearchIndex } from './build-search-index';
import { catalogFileSchema } from './catalog-schema';
import { catalogPtBrName, matchesExerciseQuery } from './search-index';
import { getExerciseDisplayName } from '@/i18n/exercise-names';

describe('catalog search index', () => {
  it('is in sync with data/catalog/exercises.json (run scripts/build-catalog-index.ts)', () => {
    expect(searchIndex).toEqual(buildSearchIndex(catalogFileSchema.parse(exercisesJson)));
  });

  it('translates catalog and legacy names to the curated pt-BR name', () => {
    expect(catalogPtBrName('Barbell bench press')).toBe('Supino reto com barra');
    expect(catalogPtBrName('BARBELL BENCH PRESS')).toBe('Supino reto com barra');
    expect(catalogPtBrName('My custom thing')).toBeNull();
    expect(getExerciseDisplayName('Barbell bench press', 'pt-BR')).toBe('Supino reto com barra');
    expect(getExerciseDisplayName('Barbell bench press', 'en')).toBe('Barbell bench press');
  });

  it('finds exercises by pt-BR words, aliases and accents', () => {
    const name = 'Lat pulldown (wide grip)';
    const display = 'Puxada alta aberta';
    expect(matchesExerciseQuery(name, display, 'puxada')).toBe(true);
    expect(matchesExerciseQuery(name, display, 'PULLEY')).toBe(true);
    expect(matchesExerciseQuery(name, display, 'lat pulldown')).toBe(true);
    expect(matchesExerciseQuery(name, display, 'agachamento')).toBe(false);
    expect(
      matchesExerciseQuery('Barbell bench press', 'Supino reto com barra', 'supino barra'),
    ).toBe(true);
    expect(matchesExerciseQuery('Hip thrust', 'Elevação pélvica', 'elevacao pelvica')).toBe(true);
  });

  it('matches custom exercises on their own name only', () => {
    expect(matchesExerciseQuery('My odd machine', 'My odd machine', 'odd')).toBe(true);
    expect(matchesExerciseQuery('My odd machine', 'My odd machine', 'supino')).toBe(false);
  });

  it('keeps an empty query matching everything', () => {
    expect(matchesExerciseQuery('Anything', 'Qualquer', '   ')).toBe(true);
  });
});
