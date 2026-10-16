'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OfflineNotice } from '@/components/ui/screen-state';
import { AuthHeading, FormField, FormMessage, fieldErrorId } from '@/components/auth/form-field';
import { useOnline } from '@/components/auth/use-online';

type FormValues = { password: string; confirm: string };

// Sets the new password from an e-mailed link. The token leaves the address
// bar as soon as the page loads, so it is not kept in the history or shared
// by a copied URL.
export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const online = useOnline();
  const [status, setStatus] = useState<'idle' | 'invalid' | 'error'>(token ? 'idle' : 'invalid');
  const schema = useMemo(
    () =>
      z
        .object({
          password: z.string().min(8, t('validation.passwordMin')),
          confirm: z.string(),
        })
        .refine((values) => values.password === values.confirm, {
          path: ['confirm'],
          message: t('reset.mismatch'),
        }),
    [t],
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  });

  useEffect(() => {
    window.history.replaceState(null, '', '/reset-password');
  }, []);

  async function onSubmit(values: FormValues) {
    const res = await fetch('/api/auth/password-reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: values.password }),
    }).catch(() => null);
    if (res?.ok) {
      router.replace('/login?reset=1');
      return;
    }
    setStatus(res?.status === 400 ? 'invalid' : 'error');
  }

  return (
    <div className="flex flex-col gap-8">
      <AuthHeading title={t('reset.title')} description={t('reset.description')} />

      {status === 'invalid' ? (
        <div className="flex flex-col gap-5">
          <FormMessage role="status">{t('reset.invalid')}</FormMessage>
          <Button asChild variant="ink" className="w-full">
            <Link href="/forgot-password">{t('reset.requestNew')}</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
          {!online && <OfflineNotice>{t('offline')}</OfflineNotice>}
          <FormField
            id="new-password"
            label={t('reset.newPassword')}
            error={errors.password?.message}
          >
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.password ? 'true' : 'false'}
              aria-describedby={errors.password ? fieldErrorId('new-password') : undefined}
              {...register('password')}
            />
          </FormField>
          <FormField
            id="confirm-password"
            label={t('reset.confirmPassword')}
            error={errors.confirm?.message}
          >
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.confirm ? 'true' : 'false'}
              aria-describedby={errors.confirm ? fieldErrorId('confirm-password') : undefined}
              {...register('confirm')}
            />
          </FormField>
          {status === 'error' && <FormMessage>{t('reset.error')}</FormMessage>}
          <Button type="submit" className="mt-1 w-full" loading={isSubmitting}>
            {t('reset.submit')}
          </Button>
        </form>
      )}
    </div>
  );
}
