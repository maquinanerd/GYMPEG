import { SignupForm } from '@/components/auth/signup-form';
import { BarbellIcon } from '@/components/ui/icon';

export default function SignupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="flex items-center gap-2">
        <BarbellIcon className="size-7" />
        <span className="text-xl font-semibold">GYM Peg</span>
      </div>
      <SignupForm />
    </main>
  );
}
