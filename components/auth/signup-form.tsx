'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
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

type FormValues = { displayName: string; email: string; password: string };

export function SignupForm() {
  const t = useTranslations('auth');
  const common = useTranslations('common');
  const router = useRouter();
  const online = useOnline();
  const [serverError, setServerError] = useState<string | null>(null);
  const schema = useMemo(
    () =>
      z.object({
        displayName: z.string().trim().min(1, t('validation.nameRequired')).max(80),
        email: z.string().email(t('validation.invalidEmail')),
        password: z.string().min(8, t('validation.passwordMin')),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: '', email: '', password: '' },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...values,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });

    if (res.ok) {
      router.replace('/');
      router.refresh();
      return;
    }

    setServerError(res.status === 403 ? t('signup.restricted') : t('signup.error'));
  }

  return (
    <div className="flex flex-col gap-8">
      <AuthHeading title={t('signup.title')} description={t('signup.description')} />

      {!online && <OfflineNotice>{t('offline')}</OfflineNotice>}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        <FormField
          id="displayName"
          label={common('fields.name')}
          error={errors.displayName?.message}
        >
          <Input
            id="displayName"
            autoComplete="name"
            aria-invalid={errors.displayName ? 'true' : 'false'}
            aria-describedby={errors.displayName ? fieldErrorId('displayName') : undefined}
            {...register('displayName')}
          />
        </FormField>

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

        <FormField
          id="password"
          label={common('fields.password')}
          error={errors.password?.message}
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.password ? 'true' : 'false'}
            aria-describedby={errors.password ? fieldErrorId('password') : undefined}
            {...register('password')}
          />
        </FormField>

        {serverError && <FormMessage>{serverError}</FormMessage>}

        <Button type="submit" className="mt-1 w-full" loading={isSubmitting}>
          {t('signup.submit')}
        </Button>
      </form>

      <p className="border-t border-border pt-5 text-caption text-muted-foreground">
        {t('signup.hasAccount')}{' '}
        <Link href="/login" className={inlineLinkClass}>
          {t('signup.signIn')}
        </Link>
      </p>
    </div>
  );
}
