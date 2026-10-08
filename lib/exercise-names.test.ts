import { describe, expect, it } from 'vitest';
import { EXERCISE_CATALOG } from '@/lib/exercise-catalog';
import { programTemplates } from '@/lib/programs/templates';
import { exerciseNameDictionaries, getExerciseDisplayName } from '@/i18n/exercise-names';

describe('exercise name localization', () => {
  it('translates a recognized exercise into Russian', () => {
    expect(getExerciseDisplayName('Bench Press', 'ru')).toBe('Жим лёжа');
  });

  it('translates a recognized exercise into French', () => {
    expect(getExerciseDisplayName('Bench Press', 'fr')).toBe('Développé couché');
  });

  it('translates recognized exercises into Brazilian gym vocabulary', () => {
    // Catalog exercises (and their legacy names) use the curated pt-BR name
    // from data/catalog; the static dictionary covers the rest.
    expect(getExerciseDisplayName('Bench Press', 'pt-BR')).toBe('Supino reto com barra');
    expect(getExerciseDisplayName('Barbell bench press', 'pt-BR')).toBe('Supino reto com barra');
    expect(getExerciseDisplayName('Lat Pulldown', 'pt-BR')).toBe('Puxada alta aberta');
    expect(getExerciseDisplayName('Leg extension', 'pt-BR')).toBe('Cadeira extensora');
    expect(getExerciseDisplayName('Lying leg curl', 'pt-BR')).toBe('Mesa flexora');
    expect(getExerciseDisplayName('Seated Cable Row', 'pt-BR')).toBe('Remada baixa com triângulo');
    expect(getExerciseDisplayName('Skullcrusher', 'pt-BR')).toBe('Tríceps testa com barra W');
    expect(getExerciseDisplayName('Face Pull', 'pt-BR')).toBe('Face pull na polia com corda');
    expect(getExerciseDisplayName('Squats · Barbell', 'pt-BR')).toBe('Agachamento · Barra');
  });

  it('keeps English and unknown custom names unchanged', () => {
    expect(getExerciseDisplayName('Bench Press', 'en')).toBe('Bench Press');
    expect(getExerciseDisplayName('Шея зад · Misc', 'ru')).toBe('Шея зад · Misc');
  });

  it('matches known names case-insensitively', () => {
    expect(getExerciseDisplayName('bEnCh PrEsS', 'ru')).toBe('Жим лёжа');
  });

  it('covers every built-in catalog exercise in Russian', () => {
    const missing = EXERCISE_CATALOG.map((exercise) => exercise.name).filter(
      (name) => getExerciseDisplayName(name, 'ru') === name,
    );
    expect(missing).toEqual([]);
  });

  it('covers every built-in catalog exercise in French', () => {
    const missing = EXERCISE_CATALOG.map((exercise) => exercise.name).filter(
      (name) => getExerciseDisplayName(name, 'fr') === name,
    );
    expect(missing).toEqual([]);
  });

  it('covers every exercise used by built-in program templates in French', () => {
    const names = new Set(
      programTemplates.flatMap((template) =>
        template.program.workouts.flatMap((workout) =>
          workout.exercises.map((exercise) => exercise.name),
        ),
      ),
    );
    const missing = [...names].filter((name) => getExerciseDisplayName(name, 'fr') === name);
    expect(missing).toEqual([]);
  });

  it('covers every exercise used by built-in program templates in Russian', () => {
    const names = new Set(
      programTemplates.flatMap((template) =>
        template.program.workouts.flatMap((workout) =>
          workout.exercises.map((exercise) => exercise.name),
        ),
      ),
    );
    const missing = [...names].filter((name) => getExerciseDisplayName(name, 'ru') === name);
    expect(missing).toEqual([]);
  });

  it('covers every built-in catalog exercise in Brazilian Portuguese', () => {
    const missing = EXERCISE_CATALOG.map((exercise) => exercise.name).filter(
      (name) => getExerciseDisplayName(name, 'pt-BR') === name,
    );
    expect(missing).toEqual([]);
  });

  it('covers every exercise used by built-in program templates in Brazilian Portuguese', () => {
    const names = new Set(
      programTemplates.flatMap((template) =>
        template.program.workouts.flatMap((workout) =>
          workout.exercises.map((exercise) => exercise.name),
        ),
      ),
    );
    const missing = [...names].filter((name) => getExerciseDisplayName(name, 'pt-BR') === name);
    expect(missing).toEqual([]);
  });

  it('translates in Brazilian Portuguese every name another locale translates', () => {
    const otherNames = new Set(
      Object.entries(exerciseNameDictionaries)
        .filter(([locale]) => locale !== 'pt-BR')
        .flatMap(([, dictionary]) => Object.keys(dictionary ?? {})),
    );
    const brazilian = exerciseNameDictionaries['pt-BR'] ?? {};
    const missing = [...otherNames].filter((name) => !(name in brazilian));
    expect(missing).toEqual([]);
  });

  it('keeps locale dictionaries separate from application messages', () => {
    expect(exerciseNameDictionaries.ru?.['Bench Press']).toBe('Жим лёжа');
  });
});
