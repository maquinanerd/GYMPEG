import fs from 'node:fs';
import path from 'node:path';

const sourceRoot = path.resolve(process.argv[2] ?? '');
if (!sourceRoot || !fs.existsSync(path.join(sourceRoot, 'dist', 'exercises.json'))) {
  throw new Error('Pass the path to a free-exercise-db checkout.');
}

const mediaCatalogPath = 'data/exercise-media.json';
const appCatalog = JSON.parse(fs.readFileSync(mediaCatalogPath, 'utf8'));
// The free-exercise-db images come from a dataset whose provenance is not
// verified (docs/EXERCISE_MEDIA_AUDIT.md). They ship only while the product
// owner keeps the source approved (ADR-005, 2026-10-14 revision).
if (appCatalog.source.approvedForProduction !== true) {
  throw new Error(
    `Media source "${appCatalog.source.id}" is not approved for production (license: ${appCatalog.source.license}).`,
  );
}
const sourceCatalog = JSON.parse(
  fs.readFileSync(path.join(sourceRoot, 'dist', 'exercises.json'), 'utf8'),
);
const byId = new Map(sourceCatalog.map((exercise) => [exercise.id, exercise]));

// Every global catalog exercise that names its free-exercise-db reference
// (sourceRef) gets that reference's frames under its canonical and legacy
// names. The catalog wins over an older hand-made group for the same name.
const normalize = (name) => name.trim().toLocaleLowerCase('en-US');
const exerciseCatalog = JSON.parse(fs.readFileSync('data/catalog/exercises.json', 'utf8'));
const catalogNames = new Map();
for (const exercise of exerciseCatalog.exercises) {
  if (!exercise.sourceRef) continue;
  for (const name of [exercise.name, ...exercise.legacyNames]) {
    catalogNames.set(normalize(name), { name, datasetId: exercise.sourceRef });
  }
}
const groups = appCatalog.groups
  .map((group) => ({
    ...group,
    names: group.names.filter((name) => !catalogNames.has(normalize(name))),
  }))
  .filter((group) => group.names.length > 0);
for (const { name, datasetId } of catalogNames.values()) {
  let group = groups.find((item) => item.datasetId === datasetId && item.approximate !== true);
  if (!group) {
    group = { datasetId, names: [] };
    groups.push(group);
  }
  if (!group.names.some((existing) => normalize(existing) === normalize(name))) {
    group.names.push(name);
  }
}
appCatalog.groups = groups;
fs.writeFileSync(mediaCatalogPath, `${JSON.stringify(appCatalog, null, 2)}\n`);

const destinationRoot = path.resolve('public', 'exercise-media', appCatalog.source.id);
fs.mkdirSync(destinationRoot, { recursive: true });

for (const datasetId of new Set(groups.map((group) => group.datasetId))) {
  const exercise = byId.get(datasetId);
  if (!exercise) throw new Error(`Unknown free-exercise-db id: ${datasetId}`);
  if (!Array.isArray(exercise.images) || exercise.images.length < 2) {
    throw new Error(`Exercise ${datasetId} does not have two frames.`);
  }
  const targetDirectory = path.join(destinationRoot, datasetId);
  fs.mkdirSync(targetDirectory, { recursive: true });
  for (const [index, relativePath] of exercise.images.slice(0, 2).entries()) {
    fs.copyFileSync(
      path.join(sourceRoot, 'exercises', relativePath),
      path.join(targetDirectory, `${index}.jpg`),
    );
  }
}

fs.copyFileSync(path.join(sourceRoot, 'LICENSE.md'), path.join(destinationRoot, 'LICENSE.md'));
fs.writeFileSync(
  path.join(destinationRoot, 'README.md'),
  [
    '# Exercise media',
    '',
    'Source: https://github.com/yuhonas/free-exercise-db',
    'License declared by the dataset: Unlicense (see LICENSE.md). Provenance not verified:',
    'see docs/EXERCISE_MEDIA_AUDIT.md and ADR-005 (2026-10-14 revision).',
    '',
    'Only the exercise frames referenced by data/exercise-media.json are vendored here.',
    'Regenerate with `node scripts/sync-exercise-media.mjs <free-exercise-db checkout>`.',
    '',
  ].join('\n'),
);

console.log(`Synced ${groups.length} exercise media groups to ${destinationRoot}.`);
