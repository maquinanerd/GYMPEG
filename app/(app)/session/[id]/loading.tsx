import { getTranslations } from 'next-intl/server';
import { SessionRunnerSkeleton } from '@/components/session/session-runner-skeleton';

// While the server prepares the running workout: the skeleton of its screen.
export default async function SessionRunLoading() {
  const t = await getTranslations('session.offline');
  return <SessionRunnerSkeleton label={t('loading')} />;
}
