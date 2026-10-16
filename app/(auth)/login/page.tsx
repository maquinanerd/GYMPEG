import { getTranslations } from 'next-intl/server';
import { LoginForm } from '@/components/auth/login-form';

interface Props {
  searchParams: Promise<{ deleted?: string; reset?: string }>;
}

const noticeClass = 'rounded-sm bg-muted px-3.5 py-3 text-caption leading-[1.4]';

export default async function LoginPage(props: Props) {
  const { deleted, reset } = await props.searchParams;
  const t = await getTranslations('auth.login');
  return (
    <main className="flex flex-1 flex-col gap-6">
      {deleted === '1' && (
        <p role="status" className={noticeClass}>
          {t('accountDeleted')}
        </p>
      )}
      {reset === '1' && (
        <p role="status" className={noticeClass}>
          {t('passwordReset')}
        </p>
      )}
      <LoginForm />
    </main>
  );
}
