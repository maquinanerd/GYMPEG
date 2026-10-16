import { getTranslations } from 'next-intl/server';
import { SubpageSkeleton } from '@/components/programs/subpage-skeleton';

export default async function GenerateProgramLoading() {
  const t = await getTranslations('common.actions');
  return <SubpageSkeleton label={t('loading')} />;
}
