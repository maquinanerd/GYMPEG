'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { href: '/admin', key: 'overview' },
  { href: '/admin/users', key: 'users' },
  { href: '/admin/ai', key: 'ai' },
  { href: '/admin/email', key: 'email' },
  { href: '/admin/audit', key: 'audit' },
] as const;

// Section switcher of the admin panel: the segmented look, scrolling
// sideways on a phone instead of squeezing five labels.
export function AdminNav() {
  const t = useTranslations('admin.nav');
  const pathname = usePathname();
  return (
    <nav
      aria-label={t('label')}
      className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
    >
      <div className="flex w-max min-w-full gap-1 rounded-pill bg-pill p-1">
        {SECTIONS.map((section) => {
          const active =
            section.href === '/admin' ? pathname === '/admin' : pathname.startsWith(section.href);
          return (
            <Link
              key={section.href}
              href={section.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-pill px-4 text-caption transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'bg-card font-semibold text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(section.key)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
