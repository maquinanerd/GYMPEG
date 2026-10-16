import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { AI_CONSENT_VERSION, hasAiConsent, isAiFeatureEnabled } from '@/lib/ai/features';
import { WorkoutPlanner } from '@/components/ai/workout-planner';
import { SubpageHeader } from '@/components/programs/subpage-header';
import { getRuntimeEnv } from '@/lib/runtime-env';

export default async function GenerateProgramPage() {
  const t = await getTranslations('programs');
  const session = await requireSession();
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { aiConsentAt: true, aiConsentVersion: true },
  });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1">
      <SubpageHeader backHref="/programs" backLabel={t('detail.back')} title={t('aiProgram')} />
      <div className="px-5 pb-8 pt-4">
        <WorkoutPlanner
          initialConsent={hasAiConsent(user)}
          consentVersion={AI_CONSENT_VERSION}
          enabled={isAiFeatureEnabled('ai.workout_generation', await getRuntimeEnv())}
        />
      </div>
    </main>
  );
}
