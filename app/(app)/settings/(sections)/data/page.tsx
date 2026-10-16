import { getTranslations } from 'next-intl/server';
import { requireSession } from '@/lib/auth';
import { PrivacySection } from '@/components/settings/privacy-section';
import { BackupSection } from '@/components/settings/backup-section';
import { SettingsSubpage } from '@/components/settings/settings-ui';

// Data and privacy: the LGPD export and account erasure, then the JSON backup
// and restore.
export default async function DataSettingsPage() {
  const t = await getTranslations('settings');
  const auth = await requireSession();

  return (
    <SettingsSubpage backLabel={t('title')} title={t('privacy.title')}>
      <PrivacySection email={auth.email} />
      <BackupSection />
    </SettingsSubpage>
  );
}
