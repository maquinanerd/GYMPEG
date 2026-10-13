'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  BarbellIcon,
  ChartLineUpIcon,
  HouseIcon,
  UserIcon,
  type AppIcon,
} from '@/components/ui/icon';
import { cn } from '@/lib/utils';

// Routes grouped under "Treinos": the programs, the history and the exercise
// catalog share one tab (a segmented control switches between them).
export const TRAINING_ROUTES = ['/programs', '/history', '/exercises', '/session/new'] as const;

function startsWithRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

const ITEMS: {
  key: 'home' | 'training' | 'progress' | 'profile';
  href: string;
  icon: AppIcon;
  isActive: (pathname: string) => boolean;
}[] = [
  { key: 'home', href: '/', icon: HouseIcon, isActive: (p) => p === '/' },
  {
    key: 'training',
    href: '/programs',
    icon: BarbellIcon,
    isActive: (p) => TRAINING_ROUTES.some((route) => startsWithRoute(p, route)),
  },
  {
    key: 'progress',
    href: '/progress',
    icon: ChartLineUpIcon,
    isActive: (p) => startsWithRoute(p, '/progress'),
  },
  {
    key: 'profile',
    href: '/settings',
    icon: UserIcon,
    isActive: (p) => startsWithRoute(p, '/settings'),
  },
];

// Floating bottom bar (68px, pill, 16px from the sides, 28px above the safe
// area). The active item is a lime pill; the others stay on the dark bar.
export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations('navigation');
  return (
    <nav
      aria-label={t('mainLabel')}
      className="fixed inset-x-4 bottom-[calc(1.75rem+env(safe-area-inset-bottom))] z-30 mx-auto flex h-nav max-w-[40rem] gap-1 rounded-pill bg-nav p-1.5"
    >
      {ITEMS.map(({ key, href, icon: Glyph, isActive }) => {
        const active = isActive(pathname);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-pill text-small transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nav-active',
              active
                ? 'flex-[1.3] bg-nav-active font-semibold text-nav-active-foreground'
                : 'flex-1 text-nav-foreground hover:bg-nav-foreground/10',
            )}
          >
            <Glyph className="size-[22px]" />
            <span className="truncate">{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
