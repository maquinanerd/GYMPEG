'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { TabLinks } from '@/components/ui/tabs';

const SECTIONS = [
  { href: '/admin', key: 'overview' },
  { href: '/admin/users', key: 'users' },
  { href: '/admin/ai', key: 'ai' },
  { href: '/admin/email', key: 'email' },
  { href: '/admin/audit', key: 'audit' },
] as const;

// Section switcher of the admin panel: underlined route tabs on a hairline,
// scrolling sideways on a phone instead of squeezing five labels.
export function AdminNav() {
  const t = useTranslations('admin.nav');
  const pathname = usePathname();
  return (
    <TabLinks
      label={t('label')}
      items={SECTIONS.map((section) => ({
        href: section.href,
        label: t(section.key),
        active:
          section.href === '/admin' ? pathname === '/admin' : pathname.startsWith(section.href),
      }))}
    />
  );
}
