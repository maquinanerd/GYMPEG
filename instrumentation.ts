// Runs once when the Next.js server starts (Node runtime only).
//
// Syncs the curated global exercise catalog (data/catalog) into the database.
// The sync compares a content hash and does nothing when the catalog did not
// change, so a normal restart costs one query. Set CATALOG_SYNC=off to skip it
// (e.g. a read replica). A failure is logged, never fatal: the app keeps
// serving with the catalog already in the database.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.CATALOG_SYNC === 'off') return;
  const { db } = await import('@/lib/db');
  const { syncGlobalCatalog } = await import('@/lib/catalog/sync');
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
