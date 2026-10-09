import { getTranslations } from 'next-intl/server';
import { LoginForm } from '@/components/auth/login-form';
import { Dumbbell } from 'lucide-react';

interface Props {
  searchParams: Promise<{ deleted?: string; reset?: string }>;
}

export default async function LoginPage(props: Props) {
  const { deleted, reset } = await props.searchParams;
  const t = await getTranslations('auth.login');
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="flex items-center gap-2">
        <Dumbbell className="size-7" />
        <span className="text-xl font-semibold">GYM Peg</span>
      </div>
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
