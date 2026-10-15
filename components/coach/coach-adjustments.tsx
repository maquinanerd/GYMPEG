'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tag } from '@/components/ui/tag';
import type { Adjustment } from '@/lib/coach-adjustments';
import type { ProgramExerciseDefaults } from './coach-client';
import { useExerciseName } from '@/components/shared/use-exercise-name';

interface Props {
  debriefId: string;
  initialAdjustments: Adjustment[];
  programDefaults: Record<string, ProgramExerciseDefaults>;
  alreadyApplied: boolean;
  onApplied: (appliedAt: string) => void;
}

interface Row {
  selected: boolean;
  data: Adjustment;
}

// The coach's suggestions pre-filled with the current program values when the
// coach left one out.
export function withProgramDefaults(
  a: Adjustment,
  programDefaults: Record<string, ProgramExerciseDefaults>,
): Adjustment {
  const def = programDefaults[a.exerciseName];
  return {
    ...a,
    suggestedRepsMin: a.suggestedRepsMin ?? def?.targetRepsMin ?? null,
    suggestedRepsMax: a.suggestedRepsMax ?? def?.targetRepsMax ?? null,
    suggestedSets: a.suggestedSets ?? def?.targetSets ?? null,
    suggestedRIR: a.suggestedRIR ?? def?.targetRIR ?? null,
    suggestedRestSec: a.suggestedRestSec ?? def?.restSec ?? null,
  };
}

// Review of a debrief's adjustments (opened from "Revisar ajuste"): pick and
// edit each one, then apply. This is the confirmation step: nothing reaches
// the program before "Aplicar".
export function CoachAdjustments({
  debriefId,
  initialAdjustments,
  programDefaults,
  alreadyApplied,
  onApplied,
}: Props) {
  const t = useTranslations('coach.adjustments');
  const exerciseName = useExerciseName();
  const [rows, setRows] = useState<Row[]>(() =>
    initialAdjustments.map((a) => ({
      selected: !alreadyApplied,
      data: withProgramDefaults(a, programDefaults),
    })),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (initialAdjustments.length === 0) return null;

  function patchRow(index: number, patch: Partial<Adjustment>) {
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, data: { ...r.data, ...patch } } : r)));
  }

  function toggleRow(index: number, selected: boolean) {
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, selected } : r)));
  }

  async function applyAll() {
    const selected = rows.filter((r) => r.selected).map((r) => r.data);
    if (selected.length === 0) {
      setError(t('noneSelected'));
      return;
    }
    setPending(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch(`/api/coach/${debriefId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustments: selected }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? t('error'));
      }
      const j = (await res.json()) as {
        appliedAt: string;
        applied: { exerciseName: string }[];
        skipped: { exerciseName: string; reason: string }[];
      };
      setFeedback(
        t('done', {
          count: j.applied.length,
          skipped: j.skipped.length,
          names: j.skipped.map((s) => exerciseName(s.exerciseName)).join(', '),
        }),
      );
      onApplied(j.appliedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error'));
    } finally {
      setPending(false);
    }
  }

  const selectedCount = rows.filter((r) => r.selected).length;

  return (
    <div className="flex flex-col gap-4">
      {alreadyApplied && <Tag>{t('applied')}</Tag>}
      <ul>
        {rows.map((row, i) => (
          <li key={i} className="flex flex-col gap-3 border-t border-border py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-body font-semibold">{exerciseName(row.data.exerciseName)}</p>
                {/* Written by the coach: italic. */}
                <p className="text-caption font-medium italic">{row.data.summary}</p>
                {row.data.rationale && (
                  <p className="text-caption font-medium italic text-muted-foreground">
                    {row.data.rationale}
                  </p>
                )}
              </div>
              <Switch
                checked={row.selected}
                onCheckedChange={(v) => toggleRow(i, v)}
                disabled={pending}
                aria-label={t('aria', { exercise: exerciseName(row.data.exerciseName) })}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <NumberField
                label={t('sets')}
                value={row.data.suggestedSets ?? null}
                onChange={(v) => patchRow(i, { suggestedSets: v })}
                disabled={!row.selected || pending}
              />
              <NumberField
                label={t('repsMin')}
                value={row.data.suggestedRepsMin ?? null}
                onChange={(v) => patchRow(i, { suggestedRepsMin: v })}
                disabled={!row.selected || pending}
              />
              <NumberField
                label={t('repsMax')}
                value={row.data.suggestedRepsMax ?? null}
                onChange={(v) => patchRow(i, { suggestedRepsMax: v })}
                disabled={!row.selected || pending}
              />
              <NumberField
                label="RIR"
                value={row.data.suggestedRIR ?? null}
                onChange={(v) => patchRow(i, { suggestedRIR: v })}
                disabled={!row.selected || pending}
              />
              <NumberField
                label={t('rest')}
                value={row.data.suggestedRestSec ?? null}
                onChange={(v) => patchRow(i, { suggestedRestSec: v })}
                disabled={!row.selected || pending}
              />
              {row.data.suggestedLoad != null && (
                <div className="flex flex-col gap-1">
                  <span className="text-small text-muted-foreground">{t('targetLoad')}</span>
                  <span className="flex min-h-11 items-center font-num text-caption font-semibold tabular-nums stretch-112">
                    {row.data.suggestedLoad} kg
                    {row.data.currentLoad != null && t('versus', { value: row.data.currentLoad })}
                  </span>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        {error && (
          <p role="alert" className="text-caption text-destructive-text">
            {error}
          </p>
        )}
        {feedback && (
          <p role="status" className="text-caption font-semibold text-brand-strong">
            {feedback}
          </p>
        )}
        <Button
          type="button"
          onClick={applyAll}
          loading={pending}
          disabled={pending || selectedCount === 0}
          className="w-full"
        >
          {pending ? t('applying') : t('apply', { count: selectedCount })}
        </Button>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-small text-muted-foreground">{label}</span>
      <Input
        type="number"
        inputMode="numeric"
        value={value ?? ''}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') onChange(null);
          else {
            const n = parseInt(raw, 10);
            onChange(Number.isNaN(n) ? null : n);
          }
        }}
        disabled={disabled}
        className="h-11 text-center font-num tabular-nums stretch-112"
      />
    </label>
  );
}
