import { getTranslations } from 'next-intl/server';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { pickableExerciseWhere } from '@/lib/catalog/access';
import { GymProfilesSection } from '@/components/settings/gym-profiles-section';
import { SettingsSubpage } from '@/components/settings/settings-ui';

export default async function GymsSettingsPage() {
  const t = await getTranslations('settings');
  const auth = await requireSession();
  const [user, gyms, exercises] = await Promise.all([
    db.user.findUnique({ where: { id: auth.userId }, select: { activeGymId: true } }),
    db.gym.findMany({
      where: { userId: auth.userId },
      orderBy: { name: 'asc' },
      include: { exerciseConfigs: true },
    }),
    db.exercise.findMany({
      where: pickableExerciseWhere(auth.userId),
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <SettingsSubpage
      backLabel={t('title')}
      title={t('gyms.title')}
      description={t('gyms.description')}
    >
      <GymProfilesSection
        initialGyms={gyms}
        activeGymId={user?.activeGymId ?? null}
        exercises={exercises}
      />
    </SettingsSubpage>
  );
}
