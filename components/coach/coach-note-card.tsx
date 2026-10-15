'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { COACH_NOTE_MAX_LEN } from '@/lib/schemas/profile';
import { cn } from '@/lib/utils';

interface Props {
  initialNote: string | null;
}

// "Note to your coach" (issue #188): a short free-text note the user writes to
// the AI coach as their own current context (injuries, illness, life
// constraints). It is part of "what your coach sees" - correctable AI memory.
// Saves through PATCH /api/profile (ownership-scoped, Zod-bounded server-side).
export function CoachNoteCard({ initialNote }: Props) {
  const t = useTranslations('coach.note');
  const [note, setNote] = useState(initialNote ?? '');
  const [saved, setSaved] = useState(initialNote ?? '');
  const [busy, setBusy] = useState(false);

  const trimmed = note.trim();
  const dirty = trimmed !== saved.trim();
  const overLimit = note.length > COACH_NOTE_MAX_LEN;

  async function persist(value: string | null) {
    setBusy(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachNote: value }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? t('error'));
        return false;
      }
      return true;
    } catch {
      toast.error(t('error'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (overLimit) return;
    // Empty after trim is a clear; the server coerces "" to null all the same.
    const value = trimmed.length > 0 ? trimmed : null;
    if (await persist(value)) {
      setNote(value ?? '');
      setSaved(value ?? '');
      toast.success(value ? t('saved') : t('cleared'));
    }
  }

  async function handleClear() {
    if (await persist(null)) {
      setNote('');
      setSaved('');
      toast.success(t('cleared'));
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <label htmlFor="coach-note" className="text-subtitle">
        {t('title')}
      </label>
      <p id="coach-note-description" className="-mt-1 text-[0.8125rem] font-medium text-muted-foreground">
        {t('description')}
      </p>
      <Textarea
        id="coach-note"
        aria-describedby="coach-note-description"
        placeholder={t('placeholder')}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={COACH_NOTE_MAX_LEN}
        className="resize-none"
      />
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'font-num text-small tabular-nums stretch-112',
            overLimit ? 'text-destructive-text' : 'text-muted-foreground',
          )}
        >
          {note.length}/{COACH_NOTE_MAX_LEN}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11"
            onClick={handleClear}
            disabled={busy || (saved.trim().length === 0 && trimmed.length === 0)}
          >
            {t('clear')}
          </Button>
          <Button
            type="button"
            variant="ink"
            size="sm"
            className="h-11"
            onClick={handleSave}
            loading={busy}
            disabled={busy || overLimit || !dirty}
          >
            {t('save')}
          </Button>
        </div>
      </div>
    </section>
  );
}
