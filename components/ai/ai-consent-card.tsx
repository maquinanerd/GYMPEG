'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const ITEMS = ['profile', 'availability', 'body', 'training'] as const;

// The notice the lifter accepts before any of their data reaches an AI
// provider (LGPD consent, addendum 02 §32). Accepting posts the exact version
// shown, so an outdated screen cannot accept a newer notice.
export function AiConsentCard({
  version,
  onAccepted,
}: {
  version: string;
  onAccepted: () => void;
}) {
  const t = useTranslations('ai.consent');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });
      if (!res.ok) throw new Error(String(res.status));
      onAccepted();
    } catch {
      setError(t('error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5" />
          <h2 className="text-base font-semibold">{t('title')}</h2>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p>{t('description')}</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          {ITEMS.map((item) => (
            <li key={item}>{t(`items.${item}`)}</li>
          ))}
        </ul>
        <p className="text-muted-foreground">{t('notSent')}</p>
        <p className="text-xs text-muted-foreground">{t('withdraw')}</p>
        <div>
          <Button type="button" onClick={accept} disabled={saving} className="min-h-tap">
            {saving && <Loader2 className="size-4 animate-spin" />}
            <span className={saving ? 'ml-2' : undefined}>{t('accept')}</span>
          </Button>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
