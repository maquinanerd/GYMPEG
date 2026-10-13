import { Logo } from '@/components/brand/logo';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage(props: Props) {
  const { token } = await props.searchParams;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <Logo size="lg" />
      <ResetPasswordForm token={typeof token === 'string' ? token : ''} />
    </main>
  );
}
