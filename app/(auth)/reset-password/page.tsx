import { ResetPasswordForm } from '@/components/auth/reset-password-form';

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage(props: Props) {
  const { token } = await props.searchParams;
  return (
    <main className="flex flex-1 flex-col">
      <ResetPasswordForm token={typeof token === 'string' ? token : ''} />
    </main>
  );
}
