import { Logo } from '@/components/brand/logo';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { canSendAppLinks } from '@/lib/email';

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <Logo size="lg" />
      <ForgotPasswordForm available={canSendAppLinks()} />
    </main>
  );
}
