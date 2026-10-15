'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AiConsentCard } from '@/components/ai/ai-consent-card';

// AI consent in Settings (LGPD): see whether it is given, withdraw it, or give
// it from here.
export function AiConsentSection({
  initialConsent,
  consentVersion,
}: {
  initialConsent: boolean;
  consentVersion: string;
}) {
  const t = useTranslations('ai.consent');
  const [consented, setConsented] = useState(initialConsent);
  const [withdrawing, setWithdrawing] = useState(false);

  async function withdraw() {
    setWithdrawing(true);
    try {
      const res = await fetch('/api/ai/consent', { method: 'DELETE' });
      if (!res.ok) throw new Error(String(res.status));
      setConsented(false);
      toast.success(t('settingsWithdrawn'));
    } catch {
      toast.error(t('error'));
    } finally {
      setWithdrawing(false);
    }
  }

  if (!consented) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-caption text-muted-foreground">{t('settingsMissing')}</p>
        <AiConsentCard version={consentVersion} onAccepted={() => setConsented(true)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body">{t('settingsGranted')}</p>
      <Button
        type="button"
        variant="outline"
        onClick={withdraw}
        loading={withdrawing}
        disabled={withdrawing}
        className="w-full sm:w-auto sm:self-start"
      >
        {t('settingsWithdraw')}
      </Button>
    </div>
  );
}
