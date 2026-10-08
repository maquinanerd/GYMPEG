import type { ExerciseMedia } from '@/lib/exercise-media';

// Stand-in for '@/lib/exercise-media' in component tests. Production serves no
// media until a licensed source is approved (docs/EXERCISE_MEDIA_AUDIT.md), so
// UI tests that cover the "has media" branch use this fixture instead of the
// real catalog:
//
//   vi.mock('@/lib/exercise-media', async () =>
//     (await import('@/tests/fixtures/exercise-media-mock')).exerciseMediaMock);

const FIXTURE: Record<string, { datasetId: string; approximate: boolean }> = {
  'barbell bench press': { datasetId: 'Barbell_Bench_Press', approximate: false },
  'bulgarian split squat': { datasetId: 'Split_Squat', approximate: true },
  'squats · barbell': { datasetId: 'Barbell_Squat', approximate: false },
};

function getExerciseMedia(name: string): ExerciseMedia | null {
  const hit = FIXTURE[name.trim().toLocaleLowerCase('en-US')];
  if (!hit) return null;
  return {
    datasetId: hit.datasetId,
    frames: [
      `/exercise-media/test-fixture/${hit.datasetId}/0.jpg`,
      `/exercise-media/test-fixture/${hit.datasetId}/1.jpg`,
    ],
    approximate: hit.approximate,
    source: {
      name: 'Test fixture',
      url: 'https://example.com/test-fixture',
      license: 'Public domain (test fixture)',
    },
  };
}

export const exerciseMediaMock = {
  exerciseMediaApproved: true,
  getExerciseMedia,
  getExerciseDatasetId: (name: string) => getExerciseMedia(name)?.datasetId ?? null,
  exerciseMediaCoverage: (names: string[]) => ({
    covered: names.filter((n) => getExerciseMedia(n)),
    missing: names.filter((n) => !getExerciseMedia(n)),
  }),
};
