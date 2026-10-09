import { db } from '@/lib/db';
import { syncGlobalCatalog } from '@/lib/catalog/sync';
import { backfillProgramRevisions } from '@/lib/program-revisions';

// Node-only startup work, imported by instrumentation.ts.
//
// Syncs the curated global exercise catalog (data/catalog) into the database.
// The sync compares a content hash and does nothing when the catalog did not
// change, so a normal restart costs one query. Set CATALOG_SYNC=off to skip it
// (e.g. a read replica). A failure is logged, never fatal: the app keeps
// serving with the catalog already in the database.
async function syncCatalogAtStartup() {
  if (process.env.CATALOG_SYNC === 'off') return;
  try {
    const report = await syncGlobalCatalog(db);
    if (!report.skipped) {
      console.info(
        `[catalog] synced ${report.upserted} exercises, retired ${report.retired}, merged ${report.merged} legacy copies`,
      );
    }
  } catch (err) {
    console.error('[catalog] sync failed:', err);
  }
}

// Programs created before program versions existed get their baseline
// version, so the first edit after the upgrade can still be compared and
// undone. Programs that already have one cost a single query.
async function backfillProgramRevisionsAtStartup() {
  try {
    const recorded = await backfillProgramRevisions();
    if (recorded > 0)
      console.info(`[programs] recorded the baseline version of ${recorded} programs`);
  } catch (err) {
    console.error('[programs] version backfill failed:', err);
  }
}

await syncCatalogAtStartup();
await backfillProgramRevisionsAtStartup();
