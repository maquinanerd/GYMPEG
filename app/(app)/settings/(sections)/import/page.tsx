import { getTranslations } from 'next-intl/server';
import { requireSession } from '@/lib/auth';
import { ImportSection } from '@/components/settings/import-section';
import { SettingsSubpage } from '@/components/settings/settings-ui';

export default async function ImportSettingsPage() {
  const t = await getTranslations('settings');
  await requireSession();

  return (
    <SettingsSubpage
      backLabel={t('title')}
      title={t('overview.rows.import')}
      description={t('imports.description')}
    >
      <ImportSection />
    </SettingsSubpage>
  );
}
