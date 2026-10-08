import type { Exercise } from '@/lib/prisma-client';

// A complete Exercise row for unit tests: fixtures only spell out the fields
// they care about, so adding a column does not break every test that builds
// one by hand.
export function exerciseFixture(over: Partial<Exercise> = {}): Exercise {
  return {
    id: 'e1',
    userId: 'u',
    name: 'Exercise',
    slug: null,
    namePtBr: null,
    muscleGroup: 'OTHER',
    category: 'COMPOUND',
    movementPattern: null,
    laterality: null,
    level: null,
    equipmentTags: [],
    instructionsPtBr: [],
    commonMistakesPtBr: [],
    defaultRestSec: 90,
    notes: null,
    usesBodyweight: false,
    equipmentType: 'OTHER',
    source: null,
    sourceRef: null,
    sourceLicense: null,
    reviewStatus: null,
    active: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  };
}
