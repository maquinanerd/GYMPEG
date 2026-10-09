// Runs once when the Next.js server starts.
//
// Next compiles this file for the edge runtime too, so Node-only work (Prisma,
// pg) lives in instrumentation-node.ts and is imported only inside the
// NEXT_RUNTIME === 'nodejs' branch: Next inlines NEXT_RUNTIME at build time
// and drops that import from the edge bundle.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
