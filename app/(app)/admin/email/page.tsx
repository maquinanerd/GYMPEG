import { EmailSettings } from '@/components/admin/email-settings';
import { requireAdminPage } from '@/lib/admin';
import { getAdminConfigView } from '@/lib/admin-config';
import { canSendAppLinks, resolvePublicAppUrl } from '@/lib/email';
import { getRuntimeEnv } from '@/lib/runtime-env';

// E-mail: the provider, sender and key behind "Forgot your password?".
export default async function AdminEmailPage() {
  const session = await requireAdminPage();
  const [env, view] = await Promise.all([getRuntimeEnv(), getAdminConfigView()]);
  return (
    <EmailSettings
      view={view}
      available={canSendAppLinks(env)}
      appUrl={resolvePublicAppUrl(env)}
      adminEmail={session.email}
    />
  );
}
