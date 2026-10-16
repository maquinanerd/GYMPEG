'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OfflineNotice } from '@/components/ui/screen-state';
import {
  AuthHeading,
  FormField,
  FormMessage,
  fieldErrorId,
  inlineLinkClass,
} from '@/components/auth/form-field';
import { useOnline } from '@/components/auth/use-online';
import { cn } from '@/lib/utils';

type FormValues = { email: string };
type Status = 'idle' | 'sent' | 'unavailable' | 'tooMany' | 'error';

// Asks for a reset link. The confirmation never says whether the e-mail has
// an account (the API answers the same either way).
export function ForgotPasswordForm({ available }: { available: boolean }) {
  const t = useTranslations('auth');
  const common = useTranslations('common');
  const online = useOnline();
  const [status, setStatus] = useState<Status>(available ? 'idle' : 'unavailable');
  const schema = useMemo(
    () => z.object({ email: z.string().trim().email(t('validation.invalidEmail')) }),
    [t],
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  async function onSubmit(values: FormValues) {
    const res = await fetch('/api/auth/password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    }).catch(() => null);
    if (res?.ok) setStatus('sent');
    else if (res?.status === 503) setStatus('unavailable');
    else if (res?.status === 429) setStatus('tooMany');
    else setStatus('error');
  }

  const message =
    status === 'idle' ? null : status === 'sent' ? t('forgot.sent') : t(`forgot.${status}`);
  const showForm = status !== 'sent' && status !== 'unavailable';

  return (
    <div className="flex flex-col gap-8">
      <AuthHeading title={t('forgot.title')} description={t('forgot.description')} />

      {/* Sent and unavailable end the flow here, so they read as a note; a
          refusal sits with the form, which stays for another try. */}
      {message && !showForm && (
        <FormMessage role="status" tone="note">
          {message}
        </FormMessage>
      )}

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
          {!online && <OfflineNotice>{t('offline')}</OfflineNotice>}
          <FormField id="email" label={common('fields.email')} error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={errors.email ? 'true' : 'false'}
              aria-describedby={errors.email ? fieldErrorId('email') : undefined}
              {...register('email')}
            />
          </FormField>
          {message && <FormMessage role="status">{message}</FormMessage>}
          <Button type="submit" className="mt-1 w-full" loading={isSubmitting}>
            {t('forgot.submit')}
          </Button>
        </form>
      )}

      <p className="border-t border-border pt-3 text-caption">
        <Link
          href="/login"
          className={cn(inlineLinkClass, 'inline-flex min-h-touch items-center')}
        >
          {t('forgot.backToLogin')}
        </Link>
      </p>
    </div>
  );
}
