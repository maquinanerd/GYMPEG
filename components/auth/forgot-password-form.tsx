'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type FormValues = { email: string };
type Status = 'idle' | 'sent' | 'unavailable' | 'tooMany' | 'error';

// Asks for a reset link. The confirmation never says whether the e-mail has
// an account (the API answers the same either way).
export function ForgotPasswordForm({ available }: { available: boolean }) {
  const t = useTranslations('auth');
  const common = useTranslations('common');
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

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t('forgot.title')}</CardTitle>
        <CardDescription>{t('forgot.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <p
            role="status"
            className={
              status === 'sent'
                ? 'rounded-md bg-muted p-3 text-sm'
                : 'rounded-md bg-destructive/10 p-3 text-sm text-destructive'
            }
          >
            {message}
          </p>
        )}
        {status !== 'sent' && status !== 'unavailable' && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">{common('fields.email')}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={errors.email ? 'true' : 'false'}
                {...register('email')}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <Button type="submit" className="min-h-tap w-full text-base" disabled={isSubmitting}>
              {isSubmitting ? t('forgot.submitting') : t('forgot.submit')}
            </Button>
          </form>
        )}
        <p className="text-center text-sm">
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t('forgot.backToLogin')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
