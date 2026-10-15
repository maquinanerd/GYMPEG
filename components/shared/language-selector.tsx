'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { CheckIcon, TranslateIcon } from '@/components/ui/icon';
import { toast } from 'sonner';
import { localeLabels, locales, type Locale } from '@/i18n/config';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// Message key under common.language for each locale's translated name.
export const localeMessageKeys = {
  'pt-BR': 'portuguese',
  en: 'english',
  fr: 'french',
  ru: 'russian',
} as const satisfies Record<Locale, string>;

// Switches the interface language: saves the choice, drops the cached pages
// rendered in the old language and reloads.
export function useLocaleSwitch() {
  const locale = useLocale() as Locale;
  const t = useTranslations('common.language');
  // Explicit pending state: callers stay disabled for the whole request.
  // A transition around a fire-and-forget promise would end in the same tick.
  const [isPending, setIsPending] = useState(false);

  function changeLocale(nextLocale: Locale) {
    if (nextLocale === locale || isPending) return;
    void applyLocale(nextLocale);
  }

  async function applyLocale(nextLocale: Locale) {
    setIsPending(true);
    try {
      const response = await fetch('/api/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: nextLocale }),
      });
      if (!response.ok) throw new Error('Could not update locale.');

      if ('caches' in window) {
        const cacheNames = await window.caches.keys();
        await Promise.all(
          cacheNames
            .filter((name) => name === 'start-url' || name.startsWith('pages'))
            .map((name) => window.caches.delete(name)),
        );
      }

      window.location.reload();
    } catch {
      setIsPending(false);
      toast.error(t('error'));
    }
  }

  return { locale, isPending, changeLocale };
}

export function LanguageSelector({ showLabel = false }: { showLabel?: boolean }) {
  const t = useTranslations('common.language');
  const { locale, isPending, changeLocale } = useLocaleSwitch();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={showLabel ? 'sm' : 'icon'}
          disabled={isPending}
          aria-label={t('change')}
          // 44px touch target: the sm size alone is 40px.
          className={cn(showLabel && 'h-11 gap-1.5 px-3')}
        >
          <TranslateIcon className="size-4" />
          {showLabel && localeLabels[locale]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((item) => (
          <DropdownMenuItem key={item} onSelect={() => changeLocale(item)}>
            <CheckIcon className={cn('mr-2 size-4', item !== locale && 'invisible')} />
            {t(localeMessageKeys[item])}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
