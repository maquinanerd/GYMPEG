'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

const ITEMS = ['profile', 'availability', 'body', 'training'] as const;

// The notice the lifter accepts before any of their data reaches an AI
// provider (LGPD consent, addendum 02 §32). Accepting posts the exact version
// shown, so an outdated screen cannot accept a newer notice. Plain text on the
// page, no box, so it fits the screens that host it.
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
    <section aria-labelledby="ai-consent-title" className="flex flex-col gap-3">
      <h2 id="ai-consent-title" className="text-heading text-balance">
        {t('title')}
      </h2>
      <p className="text-body text-pretty">{t('description')}</p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-caption text-muted-foreground">
        {ITEMS.map((item) => (
          <li key={item}>{t(`items.${item}`)}</li>
        ))}
      </ul>
      <p className="text-caption text-pretty">{t('notSent')}</p>
      <p className="text-small text-muted-foreground">{t('withdraw')}</p>
      <Button
        type="button"
        onClick={accept}
        loading={saving}
        disabled={saving}
        className="mt-1 w-full sm:w-auto sm:self-start"
      >
        {t('accept')}
      </Button>
      {error && (
        <p role="alert" className="text-caption text-destructive-text">
          {error}
        </p>
      )}
    </section>
  );
}
