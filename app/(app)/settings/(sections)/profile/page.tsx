import { getTranslations } from 'next-intl/server';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { DEFAULT_TIME_ZONE } from '@/lib/timezone';
import { ProfileSection } from '@/components/settings/profile-section';
import { SettingsSubpage } from '@/components/settings/settings-ui';

export default async function ProfileSettingsPage() {
  const t = await getTranslations('settings');
  const auth = await requireSession();
  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: {
      displayName: true,
      bodyweight: true,
      sex: true,
      heightCm: true,
      goal: true,
      weeklyFrequency: true,
      unit: true,
      timezone: true,
    },
  });

  return (
    <SettingsSubpage
      backLabel={t('title')}
      title={t('profile.title')}
      description={t('profile.description')}
    >
      <ProfileSection
        initial={{
          displayName: user?.displayName ?? null,
          bodyweight: user?.bodyweight ?? null,
          sex: user?.sex ?? null,
          heightCm: user?.heightCm ?? null,
          goal: user?.goal ?? null,
          weeklyFrequency: user?.weeklyFrequency ?? null,
          unit: user?.unit ?? 'KG',
          timezone: user?.timezone ?? DEFAULT_TIME_ZONE,
        }}
      />
    </SettingsSubpage>
  );
}
