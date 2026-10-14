import { describe, it, expect } from 'vitest';
import {
  programTemplates,
  getTemplateBySlug,
  localizeProgramTemplate,
  TEMPLATE_CATALOG_SLUGS,
} from './templates';
import catalogData from '@/data/catalog/exercises.json';
import { generatedProgramSchema } from '@/lib/schemas/program-generation';
import type { Locale } from '@/i18n/config';
import englishMessages from '@/messages/en';
import frenchMessages from '@/messages/fr';
import brazilianPortugueseMessages from '@/messages/pt-BR';
import russianMessages from '@/messages/ru';

const catalogs = {
  'pt-BR': brazilianPortugueseMessages,
  en: englishMessages,
  fr: frenchMessages,
  ru: russianMessages,
} satisfies Record<Locale, typeof englishMessages>;

// Every template in every locale, as the picker shows and posts it.
const localizedTemplates = Object.entries(catalogs).flatMap(([locale, messages]) =>
  programTemplates.map((definition) => ({
    locale,
    template: localizeProgramTemplate(definition, messages.programTemplates),
  })),
);

describe('program templates', () => {
  it('points every exercise to an exercise of the curated catalog', () => {
    const catalogSlugs = new Set(catalogData.exercises.map((exercise) => exercise.slug));
    for (const template of programTemplates) {
      for (const workout of template.program.workouts) {
        for (const exercise of workout.exercises) {
          expect(
            exercise.catalogSlug && catalogSlugs.has(exercise.catalogSlug),
            `${template.slug} / ${exercise.name}: "${exercise.catalogSlug}" is not in data/catalog`,
          ).toBe(true);
        }
      }
    }
    expect(new Set(Object.values(TEMPLATE_CATALOG_SLUGS)).size).toBe(
      Object.keys(TEMPLATE_CATALOG_SLUGS).length,
    );
  });

  it('ships at least the four required established programs', () => {
    // Issue #37 asks for 5/3/1, GZCLP, a PPL split and an Upper/Lower split.
    expect(programTemplates.length).toBeGreaterThanOrEqual(4);
    const slugs = programTemplates.map((t) => t.slug);
    expect(slugs).toContain('531-bbb-4day');
    expect(slugs).toContain('gzclp-3day');
    expect(slugs).toContain('ppl-6day');
    expect(slugs).toContain('upper-lower-4day');
  });

  it('ships the expanded catalog added in issue #59', () => {
    // Issue #59 adds Starting Strength, StrongLifts 5x5, Madcow, PHUL, PHAT and
    // a beginner Full Body 3x template on top of the original five.
    const slugs = programTemplates.map((t) => t.slug);
    expect(slugs).toContain('starting-strength-3day');
    expect(slugs).toContain('stronglifts-5x5-3day');
    expect(slugs).toContain('madcow-5x5-3day');
    expect(slugs).toContain('phul-4day');
    expect(slugs).toContain('phat-5day');
    expect(slugs).toContain('full-body-3day');
    expect(programTemplates.length).toBeGreaterThanOrEqual(11);
  });

  it('every new #59 template materializes into a valid program with runnable workouts', () => {
    const newSlugs = [
      'starting-strength-3day',
      'stronglifts-5x5-3day',
      'madcow-5x5-3day',
      'phul-4day',
      'phat-5day',
      'full-body-3day',
    ];
    for (const slug of newSlugs) {
      const definition = getTemplateBySlug(slug);
      expect(definition, `${slug} should exist`).toBeDefined();
      for (const [locale, messages] of Object.entries(catalogs)) {
        const template = localizeProgramTemplate(definition!, messages.programTemplates);
        const result = generatedProgramSchema.safeParse(template.program);
        expect(result.success, `${slug} (${locale}) should validate`).toBe(true);
      }
      // A runnable program: at least one workout, each with at least one set.
      expect(definition!.program.workouts.length).toBeGreaterThan(0);
      for (const w of definition!.program.workouts) {
        expect(w.exercises.length).toBeGreaterThan(0);
        for (const ex of w.exercises) {
          expect(ex.targetSets).toBeGreaterThan(0);
        }
      }
    }
  });

  it('has unique slugs and text keys', () => {
    const slugs = programTemplates.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const keys = programTemplates.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every template program validates against the build schema in every locale', () => {
    for (const { locale, template } of localizedTemplates) {
      const result = generatedProgramSchema.safeParse(template.program);
      expect(result.success, `${template.slug} (${locale}) should be valid`).toBe(true);
    }
  });

  it('every template has display metadata in every locale', () => {
    for (const { template } of localizedTemplates) {
      expect(template.name.length).toBeGreaterThan(0);
      expect(template.summary.length).toBeGreaterThan(0);
      expect(template.attribution.length).toBeGreaterThan(0);
    }
  });

  it('names every workout once and uses every text it ships', () => {
    for (const t of programTemplates) {
      const texts = englishMessages.programTemplates[t.key];
      const workoutKeys = t.program.workouts.map((w) => w.key);
      expect([...workoutKeys].sort(), t.slug).toEqual(Object.keys(texts.workouts).sort());
      const noteKeys = new Set(
        t.program.workouts.flatMap((w) => w.exercises.flatMap((ex) => (ex.note ? [ex.note] : []))),
      );
      expect([...noteKeys].sort(), t.slug).toEqual(
        Object.keys('notes' in texts ? texts.notes : {}).sort(),
      );
    }
  });

  it('shows and saves a template in the user language', () => {
    const template = localizeProgramTemplate(
      getTemplateBySlug('531-bbb-4day')!,
      brazilianPortugueseMessages.programTemplates,
    );
    expect(template.name).toBe('5/3/1 (Boring But Big, 4 dias)');
    expect(template.program.phase).toBe('Força');
    expect(template.program.workouts.map((w) => w.name)).toEqual([
      'Dia 1 - Desenvolvimento',
      'Dia 2 - Levantamento terra',
      'Dia 3 - Supino',
      'Dia 4 - Agachamento',
    ]);
    const [mainLift, , accessory] = template.program.workouts[0]!.exercises;
    expect(mainLift?.notes).toBe(
      'Levantamento principal. Onda 5/3/1 sobre o training max; última série AMRAP.',
    );
    // The exercise itself stays the catalog row, whatever the language.
    expect(mainLift?.catalogSlug).toBe('desenvolvimento-militar-barra');
    expect(accessory?.notes).toBe('Acessório de puxada para equilibrar o volume de empurrar.');
    // Exercises without a note in the template get none.
    const ppl = localizeProgramTemplate(
      getTemplateBySlug('ppl-6day')!,
      brazilianPortugueseMessages.programTemplates,
    );
    expect(ppl.program.workouts[0]!.exercises[0]!.notes).toBeUndefined();
  });

  it('every workout has at least one exercise with a valid rep range', () => {
    for (const t of programTemplates) {
      for (const w of t.program.workouts) {
        expect(w.exercises.length).toBeGreaterThan(0);
        for (const ex of w.exercises) {
          expect(ex.targetRepsMax).toBeGreaterThanOrEqual(ex.targetRepsMin);
        }
      }
    }
  });

  it('looks up a template by slug and returns undefined for an unknown slug', () => {
    expect(getTemplateBySlug('ppl-6day')?.key).toBe('ppl');
    expect(getTemplateBySlug('does-not-exist')).toBeUndefined();
  });
});
