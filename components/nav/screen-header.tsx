'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { TabLinks } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// Header of a main screen: a 32px title (and an optional line under it) on
// the left, one action on the right. Sits on the page background, no bar.
export function ScreenHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn('flex items-center justify-between gap-3 px-5 pb-2 pt-4', className)}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.02em]">{title}</h1>
        {subtitle && <p className="text-[0.8125rem] font-medium text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

// The three lists grouped under the "Treinos" tab of the bar.
const TRAINING_TABS = [
  { href: '/programs', key: 'programs' },
  { href: '/history', key: 'history' },
  { href: '/exercises', key: 'exercises' },
] as const;

// "Treinos" header + Programas · Histórico · Exercícios underlined tabs.
export function TrainingHeader({ action }: { action?: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations('navigation');
  return (
    <>
      <ScreenHeader title={t('training')} action={action} />
      <TabLinks
        label={t('trainingLabel')}
        items={TRAINING_TABS.map((tab) => ({
          href: tab.href,
          label: t(tab.key),
          active: pathname === tab.href,
        }))}
      />
    </>
  );
}
