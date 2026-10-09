import { db } from '@/lib/db';
import { syncGlobalCatalog } from '@/lib/catalog/sync';

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

await syncCatalogAtStartup();
