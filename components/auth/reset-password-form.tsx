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
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type FormValues = { password: string; confirm: string };

// Sets the new password from an e-mailed link. The token leaves the address
// bar as soon as the page loads, so it is not kept in the history or shared
// by a copied URL.
export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
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
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t('reset.title')}</CardTitle>
        <CardDescription>{t('reset.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === 'invalid' ? (
          <>
            <p role="status" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {t('reset.invalid')}
            </p>
            <Button asChild className="min-h-tap w-full">
              <Link href="/forgot-password">{t('reset.requestNew')}</Link>
            </Button>
          </>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t('reset.newPassword')}</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={errors.password ? 'true' : 'false'}
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t('reset.confirmPassword')}</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={errors.confirm ? 'true' : 'false'}
                {...register('confirm')}
              />
              {errors.confirm && (
                <p className="text-sm text-destructive">{errors.confirm.message}</p>
              )}
            </div>
            {status === 'error' && (
              <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                {t('reset.error')}
              </p>
            )}
            <Button type="submit" className="min-h-tap w-full text-base" disabled={isSubmitting}>
              {isSubmitting ? t('reset.submitting') : t('reset.submit')}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
