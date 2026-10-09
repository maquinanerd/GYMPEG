import { Dumbbell } from 'lucide-react';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage(props: Props) {
  const { token } = await props.searchParams;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="flex items-center gap-2">
        <Dumbbell className="size-7" />
        <span className="text-xl font-semibold">GYM Peg</span>
      </div>
      <ResetPasswordForm token={typeof token === 'string' ? token : ''} />
    </main>
  );
}
