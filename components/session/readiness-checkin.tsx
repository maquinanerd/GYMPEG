'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { MuscleGroup } from '@/lib/prisma-client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { readinessCheckinInputSchema } from '@/lib/schemas/readiness';
import { muscleGroupMessageKeys } from '@/i18n/enum-keys';
import { cn } from '@/lib/utils';

// Optional, skippable pre-session readiness check-in (issue #38). Adds no
// friction: it is collapsed by default behind a single tap and never blocks
// starting a session. The latest check-in feeds the coach payload as an input
// signal; it does not change anything about how a session is logged.
//
// Soreness (per-muscle-group 1-5) and a free-text note are equally optional
// (issue #48): they live behind a second "Add soreness / note" toggle so the
// quick two-tap readiness + sleep path stays unchanged. Only rated groups are
// submitted, matching the partial-map semantics the schema and coach expect.

const SCALE = [1, 2, 3, 4, 5];

const MUSCLE_GROUPS = Object.keys(muscleGroupMessageKeys) as MuscleGroup[];

export function ReadinessCheckin() {
  const t = useTranslations('session.readiness');
  const exerciseT = useTranslations('exercises');
  const common = useTranslations('common');
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [readiness, setReadiness] = useState<number | null>(null);
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [soreness, setSoreness] = useState<Partial<Record<MuscleGroup, number>>>({});
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function setSorenessFor(group: MuscleGroup, value: number) {
    setSoreness((prev) => {
      // Tapping the current rating again clears it, so a group can be unrated.
      if (prev[group] === value) {
        const next = { ...prev };
        delete next[group];
        return next;
      }
      return { ...prev, [group]: value };
    });
  }

  async function submit() {
    if (readiness === null || sleepQuality === null) {
      toast.error(t('rateBoth'));
      return;
    }
    // Only send a soreness map / note when the user actually filled them in, so
    // the quick path stays a clean { readiness, sleepQuality } payload.
    const trimmedNote = note.trim();
    const payload = {
      readiness,
      sleepQuality,
      ...(Object.keys(soreness).length > 0 ? { soreness } : {}),
      ...(trimmedNote.length > 0 ? { note: trimmedNote } : {}),
    };

    // Validate locally with the same schema the route uses, so a bad note
    // length (etc.) is caught before the round-trip.
    const parsed = readinessCheckinInputSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(t('invalid'));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      toast.success(t('saved'));
      setSaved(true);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => setOpen(true)}
      >
        {saved ? t('update') : t('open')}
      </Button>
    );
  }

  // Straight on the page under a hairline (no card): two 1-5 scales, the
  // optional soreness and note behind a second tap, then skip / save.
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-5 border-t border-border pt-5">
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="text-subtitle">
          {t('title')}
        </h2>
        <p className="text-caption text-muted-foreground text-pretty">{t('description')}</p>
      </div>
      <ScaleRow label={t('overall')} value={readiness} onChange={setReadiness} />
      <ScaleRow label={t('sleep')} value={sleepQuality} onChange={setSleepQuality} />

      {!detailsOpen ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-3.5 self-start"
          onClick={() => setDetailsOpen(true)}
        >
          {t('details')}
        </Button>
      ) : (
        <div className="flex flex-col gap-5 border-t border-border pt-5">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-caption font-semibold">{t('soreness')}</legend>
            <p className="text-small text-muted-foreground">{t('sorenessDescription')}</p>
            <ul className="mt-1">
              {MUSCLE_GROUPS.map((group) => (
                <SorenessRow
                  key={group}
                  label={exerciseT(`muscleGroups.${muscleGroupMessageKeys[group]}`)}
                  value={soreness[group] ?? null}
                  onChange={(v) => setSorenessFor(group, v)}
                />
              ))}
            </ul>
          </fieldset>
          <div className="flex flex-col gap-2">
            <Label htmlFor="readiness-note" className="text-caption font-semibold">
              {t('note')}
            </Label>
            <Textarea
              id="readiness-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={t('notePlaceholder')}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2.5">
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(false)}
          disabled={saving}
        >
          {t('skip')}
        </Button>
        <Button type="button" onClick={submit} disabled={saving} loading={saving} className="flex-1">
          {saving ? common('actions.saving') : t('save')}
        </Button>
      </div>
    </section>
  );
}

// A 1-5 rating: toggle buttons in the widened number style, the chosen one ink.
const RATING_BUTTON =
  'flex items-center justify-center border font-num font-semibold tabular-nums stretch-112 transition-colors duration-[120ms] ease-out-quart focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none';
const RATING_ON = 'border-ink bg-ink text-ink-foreground';
const RATING_OFF = 'border-input bg-transparent text-foreground hover:bg-muted';

function ScaleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-caption font-semibold">{label}</legend>
      <div className="grid grid-cols-5 gap-2">
        {SCALE.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(RATING_BUTTON, 'h-14 rounded-md text-number', value === n ? RATING_ON : RATING_OFF)}
            aria-label={`${label}: ${n}`}
            aria-pressed={value === n}
          >
            {n}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function SorenessRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  const t = useTranslations('session.readiness');

  return (
    <li className="flex items-center justify-between gap-3 border-t border-border py-2">
      <span className="min-w-0 text-caption font-medium">{label}</span>
      <div className="grid shrink-0 grid-cols-5 gap-1">
        {SCALE.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              RATING_BUTTON,
              'size-11 rounded-sm text-caption',
              value === n ? RATING_ON : RATING_OFF,
            )}
            aria-label={t('sorenessAria', { name: label, value: n })}
            aria-pressed={value === n}
          >
            {n}
          </button>
        ))}
      </div>
    </li>
  );
}
