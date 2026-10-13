import { getTranslations } from 'next-intl/server';
import { LoginForm } from '@/components/auth/login-form';
import { Logo } from '@/components/brand/logo';

interface Props {
  searchParams: Promise<{ deleted?: string; reset?: string }>;
}

export default async function LoginPage(props: Props) {
  const { deleted, reset } = await props.searchParams;
  const t = await getTranslations('auth.login');
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <Logo size="lg" />
      {deleted === '1' && (
        <p role="status" className="max-w-sm text-center text-sm text-muted-foreground">
          {t('accountDeleted')}
        </p>
      )}
      {reset === '1' && (
        <p role="status" className="max-w-sm text-center text-sm text-muted-foreground">
          {t('passwordReset')}
        </p>
      )}
      <LoginForm />
    </main>
  );
}
