'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { locales, type Locale } from '@/i18n/config';
import { CheckIcon } from '@/components/ui/icon';
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetTitle,
  BottomSheetTrigger,
} from '@/components/ui/bottom-sheet';
import { localeMessageKeys, useLocaleSwitch } from '@/components/shared/language-selector';
import { DeleteAccountDialog } from './privacy-section';
import { RowButtonContent, rowButtonClass } from './settings-ui';

// Perfil rows that open a sheet or a dialog in place (theme, language, delete
// account). The rows that open a page are plain ListRow links.

interface Choice<T extends string> {
  value: T;
  label: string;
}

// A row whose value is picked in a bottom sheet: one radio per option, the
// chosen one checked. Picking closes the sheet.
function ChoiceRow<T extends string>({
  title,
  value,
  options,
  onPick,
  disabled,
}: {
  title: string;
  value: T | undefined;
  options: Choice<T>[];
  onPick: (value: T) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);
  return (
    <li className="border-t border-border">
      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheetTrigger className={rowButtonClass} disabled={disabled}>
          <RowButtonContent title={title} value={current?.label ?? ''} />
        </BottomSheetTrigger>
        <BottomSheetContent aria-describedby={undefined}>
          <BottomSheetTitle>{title}</BottomSheetTitle>
          <div role="radiogroup" aria-label={title}>
            {options.map((option) => {
              const checked = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => {
                    onPick(option.value);
                    setOpen(false);
                  }}
                  className="flex min-h-[3.25rem] w-full items-center justify-between gap-3 border-t border-border text-left text-body font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  {option.label}
                  {checked && <CheckIcon aria-hidden className="size-5" />}
                </button>
              );
            })}
          </div>
        </BottomSheetContent>
      </BottomSheet>
    </li>
  );
}

// Tema: light by default, dark opt-in (next-themes, see shared/theme-provider).
export function ThemeRow() {
  const t = useTranslations('settings.overview.rows');
  const common = useTranslations('common.theme');
  const { theme, setTheme } = useTheme();
  // The stored theme is only known in the browser: render "Claro" on the
  // server and the first paint, then the real value.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const value: 'light' | 'dark' = mounted && theme === 'dark' ? 'dark' : 'light';
  return (
    <ChoiceRow
      title={t('theme')}
      value={value}
      options={[
        { value: 'light', label: common('light') },
        { value: 'dark', label: common('dark') },
      ]}
      onPick={setTheme}
    />
  );
}

export function LanguageRow() {
  const t = useTranslations('settings.overview.rows');
  const language = useTranslations('common.language');
  const { locale, isPending, changeLocale } = useLocaleSwitch();
  return (
    <ChoiceRow<Locale>
      title={t('language')}
      value={locale}
      options={locales.map((item) => ({ value: item, label: language(localeMessageKeys[item]) }))}
      onPick={changeLocale}
      disabled={isPending}
    />
  );
}

// "Excluir conta": the confirmation asks for the password and the account
// e-mail typed in full before the delete button turns on.
export function DeleteAccountRow({ email }: { email: string }) {
  const t = useTranslations('settings.overview.rows');
  const [open, setOpen] = useState(false);
  return (
    <li className="border-t border-border">
      <button type="button" className={rowButtonClass} onClick={() => setOpen(true)}>
        <RowButtonContent title={t('deleteAccount')} className="text-destructive-text" />
      </button>
      <DeleteAccountDialog email={email} open={open} onOpenChange={setOpen} />
    </li>
  );
}
