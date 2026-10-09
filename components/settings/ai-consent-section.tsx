'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{t('settingsMissing')}</p>
        <AiConsentCard version={consentVersion} onAccepted={() => setConsented(true)} />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5" />
          <h2 className="text-base font-semibold">{t('settingsTitle')}</h2>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p>{t('settingsGranted')}</p>
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={withdraw}
            disabled={withdrawing}
            className="min-h-tap"
          >
            {withdrawing && <Loader2 className="size-4 animate-spin" />}
            <span className={withdrawing ? 'ml-2' : undefined}>{t('settingsWithdraw')}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
