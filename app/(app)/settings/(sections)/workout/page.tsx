import { getTranslations } from 'next-intl/server';
import { requireSession } from '@/lib/auth';
import { SettingsClient } from '@/components/settings/settings-client';
import { PlateFallbackSection } from '@/components/settings/plate-fallback-section';
import { SettingsSubpage } from '@/components/settings/settings-ui';

// Device-only preferences of the running workout (vibration, beep, flash,
// readiness) and the plate calculator's fallback inventory.
export default async function WorkoutSettingsPage() {
  const t = await getTranslations('settings');
  await requireSession();

  return (
    <SettingsSubpage
      backLabel={t('title')}
      title={t('overview.rows.workout')}
      description={t('deviceOnly')}
    >
      <SettingsClient />
      <PlateFallbackSection />
    </SettingsSubpage>
  );
}
