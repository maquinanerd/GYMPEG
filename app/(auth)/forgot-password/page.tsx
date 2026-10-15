import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { canSendAppLinks } from '@/lib/email';

export default function ForgotPasswordPage() {
  return (
    <main className="flex flex-1 flex-col">
      <ForgotPasswordForm available={canSendAppLinks()} />
    </main>
  );
}
