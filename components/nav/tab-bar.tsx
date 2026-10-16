'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  BarbellIcon,
  ChartLineUpIcon,
  ChatCircleTextIcon,
  HouseIcon,
  UserCircleIcon,
  type AppIcon,
} from '@/components/ui/icon';
import { cn } from '@/lib/utils';

// Routes grouped under "Treinos": the programs, the history and the exercise
// catalog share one tab (underlined tabs switch between them).
export const TRAINING_ROUTES = ['/programs', '/history', '/exercises', '/session/new'] as const;

function startsWithRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

const ITEMS: {
  key: 'home' | 'training' | 'progress' | 'coach' | 'profile';
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
    key: 'coach',
    href: '/coach',
    icon: ChatCircleTextIcon,
    isActive: (p) => startsWithRoute(p, '/coach') || startsWithRoute(p, '/chat'),
  },
  {
    key: 'profile',
    href: '/settings',
    icon: UserCircleIcon,
    isActive: (p) => startsWithRoute(p, '/settings'),
  },
];

// Bottom tab bar, docked to the bottom edge (not floating): card fill, a
// hairline on top, the home-indicator safe area below. The active item puts
// its filled icon on a 52×28 lime block; the others stay regular and muted.
export function TabBar() {
  const pathname = usePathname();
  const t = useTranslations('navigation');
  return (
    <nav
      aria-label={t('mainLabel')}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card px-2 pb-[calc(0.375rem+env(safe-area-inset-bottom))] pt-1.5"
    >
      <div className="mx-auto grid max-w-2xl grid-cols-5">
        {ITEMS.map(({ key, href, icon: Glyph, isActive }) => {
          const active = isActive(pathname);
          return (
            <Link
              key={key}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-[3.25rem] min-w-0 flex-col items-center justify-center gap-[3px] rounded-sm text-small focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-[3.25rem] items-center justify-center rounded-sm',
                  active && 'bg-primary text-primary-foreground',
                )}
              >
                <Glyph weight={active ? 'fill' : 'regular'} className="size-5" />
              </span>
              <span className="max-w-full truncate">{t(key)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
