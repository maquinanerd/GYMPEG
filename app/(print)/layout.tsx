import { SyncBootstrap } from '@/components/shared/sync-bootstrap';
import { getCurrentSession } from '@/lib/auth';

// Layout for print-oriented routes: no app chrome (header, nav), white page.
// The sheet itself is black on white so the browser print preview matches
// what lands on paper. SyncBootstrap stays mounted so an offline-logged set
// still flushes while the sheet is open.
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const auth = await getCurrentSession();
  return (
    <div className="min-h-screen bg-white text-black">
      <SyncBootstrap ownerId={auth?.userId ?? null} />
      {children}
    </div>
  );
}
