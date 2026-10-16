import { getTranslations } from 'next-intl/server';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { SecuritySection } from '@/components/settings/security-section';
import { SettingsSubpage } from '@/components/settings/settings-ui';

export default async function SecuritySettingsPage() {
  const t = await getTranslations('settings');
  const auth = await requireSession();
  const otherSessions = await db.authSession.count({
    where: {
      userId: auth.userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      ...(auth.sid ? { id: { not: auth.sid } } : {}),
    },
  });

  return (
    <SettingsSubpage
      backLabel={t('title')}
      title={t('overview.rows.security')}
      description={auth.email}
    >
      <SecuritySection otherSessions={otherSessions} />
    </SettingsSubpage>
  );
}
