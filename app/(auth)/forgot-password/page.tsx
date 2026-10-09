import { Dumbbell } from 'lucide-react';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { canSendAppLinks } from '@/lib/email';

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="flex items-center gap-2">
        <Dumbbell className="size-7" />
        <span className="text-xl font-semibold">GYM Peg</span>
      </div>
      <ForgotPasswordForm available={canSendAppLinks()} />
    </main>
  );
}
