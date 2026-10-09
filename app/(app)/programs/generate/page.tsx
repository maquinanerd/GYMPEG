import { Wand2 } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { AI_CONSENT_VERSION, hasAiConsent, isAiFeatureEnabled } from '@/lib/ai/features';
import { WorkoutPlanner } from '@/components/ai/workout-planner';

export default async function GenerateProgramPage() {
  const t = await getTranslations('programs');
  const session = await requireSession();
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { aiConsentAt: true, aiConsentVersion: true },
  });

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <Wand2 className="size-6" />
          <h1 className="text-2xl font-bold tracking-tight">{t('aiProgram')}</h1>
        </div>
        <WorkoutPlanner
          initialConsent={hasAiConsent(user)}
          consentVersion={AI_CONSENT_VERSION}
          enabled={isAiFeatureEnabled('ai.workout_generation')}
        />
      </div>
    </main>
  );
}
