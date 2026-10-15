import { SyncBootstrap } from '@/components/shared/sync-bootstrap';
import { AppChrome } from '@/components/nav/app-chrome';
import { getCurrentSession } from '@/lib/auth';

// Layout for protected routes (post-login). No top bars: navigation is the
// tab bar docked to the bottom edge, language/theme/logout live in Perfil and
// the sync state sits in each screen's header (components/offline/sync-status).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Cached per request (React cache): the page's own requireSession() reuses it.
  const auth = await getCurrentSession();
  return (
    <div className="flex min-h-screen flex-col">
      <SyncBootstrap ownerId={auth?.userId ?? null} />
      <AppChrome>{children}</AppChrome>
    </div>
  );
}
