import { Logo } from '@/components/brand/logo';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { canSendAppLinks } from '@/lib/email';
import { getRuntimeEnv } from '@/lib/runtime-env';

// Rendered per request: whether reset links can be sent depends on the
// runtime settings (environment and admin panel), never on the build.
export const dynamic = 'force-dynamic';

export default async function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <Logo size="lg" />
      <ForgotPasswordForm available={canSendAppLinks(await getRuntimeEnv())} />
    </main>
  );
}
