// Regenerates data/catalog/search-index.json from data/catalog/exercises.json.
// lib/catalog/search-index.test.ts fails while the committed index is stale.
//
//   npx tsx scripts/build-catalog-index.ts
import fs from 'node:fs';
import path from 'node:path';
import { buildSearchIndex } from '../lib/catalog/build-search-index';
import { catalogFileSchema } from '../lib/catalog/catalog-schema';

const root = process.cwd();
const catalog = catalogFileSchema.parse(
  JSON.parse(fs.readFileSync(path.join(root, 'data/catalog/exercises.json'), 'utf8')),
);
const index = buildSearchIndex(catalog);
fs.writeFileSync(
  path.join(root, 'data/catalog/search-index.json'),
  `${JSON.stringify(index, null, 2)}\n`,
);
console.log(`search-index.json: ${index.entries.length} entries`);
