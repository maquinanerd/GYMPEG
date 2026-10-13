import { SignupForm } from '@/components/auth/signup-form';
import { Logo } from '@/components/brand/logo';

export default function SignupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <Logo size="lg" />
      <SignupForm />
    </main>
  );
}
