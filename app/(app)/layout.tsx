import { Dumbbell } from 'lucide-react';
import { LogoutButton } from '@/components/auth/logout-button';
import { NavLinks } from '@/components/shared/nav-links';
import { OfflineIndicator } from '@/components/shared/offline-indicator';
import { SyncBootstrap } from '@/components/shared/sync-bootstrap';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { LanguageSelector } from '@/components/shared/language-selector';
import Link from 'next/link';
import { getCurrentSession } from '@/lib/auth';

// Layout for protected routes (post-login).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Cached per request (React cache): the page's own requireSession() reuses it.
  const auth = await getCurrentSession();
  return (
    <div className="flex min-h-screen flex-col">
      <SyncBootstrap ownerId={auth?.userId ?? null} />
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <Dumbbell className="size-5" />
            <span className="text-base font-semibold">GymCoach</span>
          </Link>
          <div className="flex items-center gap-2">
            <OfflineIndicator />
            <LanguageSelector />
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
        <NavLinks />
      </header>
      {children}
    </div>
  );
}
