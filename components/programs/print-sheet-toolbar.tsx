'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CaretLeftIcon, PrinterIcon } from '@/components/ui/icon';
import { Button, IconButton } from '@/components/ui/button';

// Screen-only controls above a printable sheet: hidden on paper.
export function PrintSheetToolbar({ programId }: { programId: string }) {
  const t = useTranslations('programs.print');

  return (
    <div className="flex items-center justify-between gap-3 print:hidden">
      <IconButton asChild aria-label={t('back')} className="-ml-3 text-black hover:bg-black/5">
        <Link href={`/programs/${programId}`}>
          <CaretLeftIcon />
        </Link>
      </IconButton>
      <div className="flex items-center gap-3">
        <p className="hidden max-w-xs text-small text-black/60 sm:block">{t('hint')}</p>
        {/* Lime with #111 reads the same in both themes on the white sheet. */}
        <Button variant="primary" size="sm" onClick={() => window.print()}>
          <PrinterIcon />
          {t('printButton')}
        </Button>
      </div>
    </div>
  );
}
