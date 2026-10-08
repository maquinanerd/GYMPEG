import { describe, it, expect } from 'vitest';
import exercisesJson from '@/data/catalog/exercises.json';
import musclesJson from '@/data/catalog/muscles.json';
import { EXERCISE_CATALOG } from '@/lib/exercise-catalog';

// Integrity of the curated global catalog (data/catalog/*.json). The lists
// below are copied on purpose: a change to a Prisma enum or to the catalog
// vocabulary must be a conscious change here too.

const EXERCISE_CATEGORIES = ['COMPOUND', 'ISOLATION', 'CARDIO'];
const EQUIPMENT_TYPES = [
  'DUMBBELL',
  'BARBELL',
  'MACHINE',
  'CABLE',
  'BODYWEIGHT',
  'CARDIO',
  'OTHER',
];
const MUSCLE_GROUPS = [
  'CHEST',
  'BACK_WIDTH',
  'BACK_THICKNESS',
  'SHOULDERS_FRONT',
  'SHOULDERS_LATERAL',
  'SHOULDERS_REAR',
  'BICEPS',
  'TRICEPS',
  'FOREARMS',
  'QUADS',
  'HAMSTRINGS',
  'GLUTES',
  'CALVES',
  'ABS',
  'LOWER_BACK',
  'OTHER',
];
const MOVEMENT_PATTERNS = [
  'squat',
  'hinge',
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'knee_flexion',
  'knee_extension',
  'elbow_flexion',
  'elbow_extension',
  'shoulder_abduction',
  'calf',
  'core',
  'carry',
  'isolation',
  'cardio',
];
const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'bench',
  'incline_bench',
  'rack',
  'smith_machine',
  'cable',
  'machine',
  'leg_press',
  'hack_squat',
  'leg_extension',
  'leg_curl',
  'pec_deck',
  'pull_up_bar',
  'dip_bars',
  'ez_bar',
  'band',
  'bodyweight',
  'cardio_machine',
  'other',
];
const LATERALITY = ['BILATERAL', 'UNILATERAL', 'ALTERNATING'];
const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const PRIORITIES = ['P0', 'P1'];
const MUSCLE_SLUGS = [
  'pectoralis_major',
  'anterior_deltoid',
  'lateral_deltoid',
  'posterior_deltoid',
  'biceps',
  'triceps',
  'forearm',
  'trapezius',
  'rhomboids',
  'latissimus_dorsi',
  'erector_spinae',
  'rectus_abdominis',
  'obliques',
  'gluteus',
  'abductors',
  'adductors',
  'quadriceps',
  'hamstrings',
  'calves',
];

interface Muscle {
  slug: string;
  nameEn: string;
  namePtBr: string;
  group: string;
  view: string;
}

interface Exercise {
  slug: string;
  name: string;
  namePtBr: string;
  aliases: { pt: string[]; en: string[] };
  legacyNames: string[];
  category: string;
  equipmentType: string;
  equipment: string[];
  movementPattern: string;
  muscleGroup: string;
  muscles: { primary: string[]; secondary: string[] };
  laterality: string;
  usesBodyweight: boolean;
  defaultRestSec: number;
  level: string;
  instructionsPtBr: string[];
  commonMistakesPtBr: string[];
  source: string;
  sourceRef: string | null;
  sourceLicense: string;
  reviewStatus: string;
  priority: string;
}

const file = exercisesJson as unknown as { version: number; exercises: Exercise[] };
const exercises = file.exercises;
const muscles = musclesJson as unknown as Muscle[];
const muscleBySlug = new Map(muscles.map((m) => [m.slug, m]));

// Same rule the resolver and the alias table use (accent- and case-insensitive,
// punctuation collapsed), kept local so this test only depends on the data.
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

describe('data/catalog/muscles.json', () => {
  it('has exactly the anatomical SVG ids', () => {
    expect(muscles.map((m) => m.slug).sort()).toEqual([...MUSCLE_SLUGS].sort());
  });

  it('every muscle has names, a valid group and a view', () => {
    for (const m of muscles) {
      expect(m.nameEn.trim(), m.slug).not.toBe('');
      expect(m.namePtBr.trim(), m.slug).not.toBe('');
      expect(MUSCLE_GROUPS, m.slug).toContain(m.group);
      expect(['front', 'back'], m.slug).toContain(m.view);
    }
  });
});

describe('data/catalog/exercises.json', () => {
  it('has an integer version and 150 to 300 exercises', () => {
    expect(Number.isInteger(file.version)).toBe(true);
    expect(file.version).toBeGreaterThan(0);
    expect(exercises.length).toBeGreaterThanOrEqual(150);
    expect(exercises.length).toBeLessThanOrEqual(300);
  });

  it('slugs are unique kebab-case', () => {
    const slugs = exercises.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('names are unique, ignoring case', () => {
    const names = exercises.map((e) => e.name.trim().toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    const ptNames = exercises.map((e) => e.namePtBr.trim().toLowerCase());
    expect(new Set(ptNames).size).toBe(ptNames.length);
  });

  it('every enum and vocabulary value is valid', () => {
    for (const e of exercises) {
      expect(EXERCISE_CATEGORIES, e.slug).toContain(e.category);
      expect(EQUIPMENT_TYPES, e.slug).toContain(e.equipmentType);
      expect(MUSCLE_GROUPS, e.slug).toContain(e.muscleGroup);
      expect(MOVEMENT_PATTERNS, e.slug).toContain(e.movementPattern);
      expect(LATERALITY, e.slug).toContain(e.laterality);
      expect(LEVELS, e.slug).toContain(e.level);
      expect(PRIORITIES, e.slug).toContain(e.priority);
      expect(e.reviewStatus, e.slug).toBe('draft');
      expect(e.source, e.slug).toBe('gympeg-curated');
      expect(e.sourceLicense.trim(), e.slug).not.toBe('');
      expect(
        e.sourceRef === null || (typeof e.sourceRef === 'string' && e.sourceRef.length > 0),
        e.slug,
      ).toBe(true);
      expect(typeof e.usesBodyweight, e.slug).toBe('boolean');
      expect(e.equipment.length, e.slug).toBeGreaterThan(0);
      for (const item of e.equipment) expect(EQUIPMENT, e.slug).toContain(item);
    }
  });

  it('muscles reference muscles.json, with 1-2 primaries and up to 4 secondaries', () => {
    for (const e of exercises) {
      const { primary, secondary } = e.muscles;
      expect(primary.length, e.slug).toBeGreaterThanOrEqual(1);
      expect(primary.length, e.slug).toBeLessThanOrEqual(2);
      expect(secondary.length, e.slug).toBeLessThanOrEqual(4);
      for (const slug of [...primary, ...secondary]) {
        expect(muscleBySlug.has(slug), `${e.slug} -> ${slug}`).toBe(true);
      }
      expect(
        primary.filter((slug) => secondary.includes(slug)),
        e.slug,
      ).toEqual([]);
    }
  });

  it('muscleGroup matches a primary muscle (OTHER for cardio)', () => {
    for (const e of exercises) {
      if (e.category === 'CARDIO') {
        expect(e.muscleGroup, e.slug).toBe('OTHER');
        continue;
      }
      const groups = e.muscles.primary.map((slug) => muscleBySlug.get(slug)?.group);
      expect(groups, e.slug).toContain(e.muscleGroup);
    }
  });

  it('cardio is consistent across category, equipment type and pattern', () => {
    for (const e of exercises) {
      const cardio = e.category === 'CARDIO';
      expect(e.equipmentType === 'CARDIO', e.slug).toBe(cardio);
      expect(e.movementPattern === 'cardio', e.slug).toBe(cardio);
    }
  });

  it('has 3-5 instructions and 2-3 common mistakes, none empty', () => {
    for (const e of exercises) {
      expect(e.instructionsPtBr.length, e.slug).toBeGreaterThanOrEqual(3);
      expect(e.instructionsPtBr.length, e.slug).toBeLessThanOrEqual(5);
      expect(e.commonMistakesPtBr.length, e.slug).toBeGreaterThanOrEqual(2);
      expect(e.commonMistakesPtBr.length, e.slug).toBeLessThanOrEqual(3);
      for (const text of [...e.instructionsPtBr, ...e.commonMistakesPtBr]) {
        expect(text.trim(), e.slug).not.toBe('');
      }
    }
  });

  it('defaultRestSec is an integer between 30 and 300', () => {
    for (const e of exercises) {
      expect(Number.isInteger(e.defaultRestSec), e.slug).toBe(true);
      expect(e.defaultRestSec, e.slug).toBeGreaterThanOrEqual(30);
      expect(e.defaultRestSec, e.slug).toBeLessThanOrEqual(300);
    }
  });

  it('pt-BR aliases do not repeat the pt-BR name', () => {
    for (const e of exercises) {
      const own = normalize(e.namePtBr);
      for (const alias of e.aliases.pt) expect(normalize(alias), e.slug).not.toBe(own);
    }
  });

  it('legacy names are unique across the catalog', () => {
    const legacy = exercises.flatMap((e) => e.legacyNames);
    expect(new Set(legacy).size).toBe(legacy.length);
  });

  // Name resolution and the legacy merge match on normalized text, so a term
  // shared by two exercises would resolve to whichever row the database
  // returns first.
  it('every normalized name, alias and legacy name belongs to one exercise only', () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    for (const e of exercises) {
      const terms = new Set(
        [e.name, e.namePtBr, ...e.aliases.pt, ...e.aliases.en, ...e.legacyNames].map(normalize),
      );
      for (const term of terms) {
        const other = owner.get(term);
        if (other && other !== e.slug) clashes.push(`"${term}": ${other} / ${e.slug}`);
        owner.set(term, e.slug);
      }
    }
    expect(clashes).toEqual([]);
  });

  it('covers every movement pattern except carry', () => {
    const used = new Set(exercises.map((e) => e.movementPattern));
    for (const pattern of MOVEMENT_PATTERNS.filter((p) => p !== 'carry')) {
      expect(used.has(pattern), pattern).toBe(true);
    }
  });
});

describe('legacy EXERCISE_CATALOG coverage', () => {
  const byName = new Map(exercises.map((e) => [e.name, e]));
  const legacy = new Set(exercises.flatMap((e) => e.legacyNames));

  it('every EXERCISE_CATALOG name appears in some legacyNames', () => {
    const missing = EXERCISE_CATALOG.map((c) => c.name).filter((name) => !legacy.has(name));
    expect(missing).toEqual([]);
  });

  it('every EXERCISE_CATALOG name is the exact name of a catalog exercise', () => {
    const missing = EXERCISE_CATALOG.map((c) => c.name).filter((name) => !byName.has(name));
    expect(missing).toEqual([]);
  });

  // Keeps history, volume per muscle group and equipment snapping stable when
  // the per-user copies are folded into the global exercise.
  it('keeps muscle group, category and equipment type of the legacy entries', () => {
    for (const c of EXERCISE_CATALOG) {
      const e = byName.get(c.name);
      expect(e, c.name).toBeDefined();
      expect(e!.legacyNames, c.name).toContain(c.name);
      expect(e!.muscleGroup, c.name).toBe(c.muscleGroup);
      expect(e!.category, c.name).toBe(c.category);
      expect(e!.equipmentType, c.name).toBe(c.equipmentType);
    }
  });
});
