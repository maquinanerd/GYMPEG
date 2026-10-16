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
import { textLinkClass } from '@/components/ui/section';
import { cn } from '@/lib/utils';
import {
  AuthHeading,
  FormField,
  FormMessage,
  fieldErrorId,
  inlineLinkClass,
} from '@/components/auth/form-field';
import { useOnline } from '@/components/auth/use-online';

type FormValues = { email: string; password: string };

// Public demo flag and credentials, inlined at build time. When the flag is on
// (e.g. on a public demo instance) the login page surfaces a one-click sign in.
const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL ?? '';
const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? '';
const showDemo = demoMode && demoEmail !== '' && demoPassword !== '';

export function LoginForm() {
  const t = useTranslations('auth');
  const common = useTranslations('common');
  const router = useRouter();
  const online = useOnline();
  const [serverError, setServerError] = useState<string | null>(null);
  const schema = useMemo(
    () =>
      z.object({
        email: z.string().email(t('validation.invalidEmail')),
        password: z.string().min(1, t('validation.passwordRequired')),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  async function loginAsDemo() {
    // Prefill the fields for visible feedback, then submit the demo credentials.
    setValue('email', demoEmail);
    setValue('password', demoPassword);
    await onSubmit({ email: demoEmail, password: demoPassword });
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });

    if (res.ok) {
      router.replace('/');
      router.refresh();
      return;
    }

    const body = (await res.json().catch(() => null)) as { code?: string } | null;
    setServerError(body?.code === 'ACCOUNT_BLOCKED' ? t('login.blocked') : t('login.error'));
  }

  return (
    <div className="flex flex-col gap-8">
      <AuthHeading title={t('login.title')} description={t('login.description')} />

      {!online && <OfflineNotice>{t('offline')}</OfflineNotice>}

      {showDemo && (
        <section
          aria-labelledby="demo-title"
          className="flex flex-col gap-3 border-y border-border py-4"
        >
          <h2 id="demo-title" className="text-subtitle">
            {t('login.demoTitle')}
          </h2>
          <p className="text-caption text-muted-foreground">
            {demoEmail} / {demoPassword}
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={loginAsDemo}
            loading={isSubmitting}
          >
            {t('login.demoSubmit')}
          </Button>
        </section>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
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
            autoComplete="current-password"
            aria-invalid={errors.password ? 'true' : 'false'}
            aria-describedby={errors.password ? fieldErrorId('password') : undefined}
            {...register('password')}
          />
        </FormField>

        <Link
          href="/forgot-password"
          className={cn(textLinkClass, 'inline-flex min-h-touch items-center self-start')}
        >
          {t('login.forgotPassword')}
        </Link>

        {serverError && <FormMessage>{serverError}</FormMessage>}

        <Button type="submit" className="w-full" loading={isSubmitting}>
          {t('login.submit')}
        </Button>
      </form>

      <p className="border-t border-border pt-5 text-caption text-muted-foreground">
        {t('login.noAccount')}{' '}
        <Link href="/signup" className={inlineLinkClass}>
          {t('login.createAccount')}
        </Link>
      </p>
    </div>
  );
}
