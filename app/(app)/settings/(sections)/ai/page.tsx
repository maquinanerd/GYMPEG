import { getTranslations } from 'next-intl/server';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { AI_CONSENT_VERSION, hasAiConsent } from '@/lib/ai/features';
import { AiConsentSection } from '@/components/settings/ai-consent-section';
import { SettingsSubpage } from '@/components/settings/settings-ui';

export default async function AiSettingsPage() {
  const t = await getTranslations('settings');
  const consent = await getTranslations('ai.consent');
  const auth = await requireSession();
  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: { aiConsentAt: true, aiConsentVersion: true },
  });

  return (
    <SettingsSubpage backLabel={t('title')} title={consent('settingsTitle')}>
      <AiConsentSection
        initialConsent={hasAiConsent(user ?? null)}
        consentVersion={AI_CONSENT_VERSION}
      />
    </SettingsSubpage>
  );
}
