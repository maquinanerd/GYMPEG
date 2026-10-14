'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FastForwardIcon, MinusIcon, PauseIcon, PlayIcon, PlusIcon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { REST_ADJUST_STEP_MS, restRemainingMs } from '@/lib/rest-timer';
import { playRestEndBeep } from '@/lib/sound';
import { formatWeight } from '@/lib/units';
import type { WeightUnit } from '@/lib/prisma-client';
import type { IntraSetRecommendation } from '@/lib/intra-set-autoregulation';

interface Props {
  endsAt: number;
  // Milliseconds left when the rest was paused; null (or omitted) while it runs.
  pausedRemainingMs?: number | null;
  totalSec: number;
  nextLabel: string | null | undefined;
  recommendation?: IntraSetRecommendation | null;
  unit: WeightUnit;
  onEnd: () => void;
  onSkip: () => void;
  onPause: () => void;
  onResume: () => void;
  // Signed change of the remaining time, in milliseconds (issue #393).
  onAdjust: (deltaMs: number) => void;
}

export function RestTimer({
  endsAt,
  pausedRemainingMs = null,
  totalSec,
  nextLabel,
  recommendation = null,
  unit,
  onEnd,
  onSkip,
  onPause,
  onResume,
  onAdjust,
}: Props) {
  const t = useTranslations('session.rest');
  const autoT = useTranslations('session.autoregulation');
  const locale = useLocale();
  const [now, setNow] = useState(() => Date.now());
  const endedRef = useRef(false);

  useEffect(() => {
    endedRef.current = false;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [endsAt]);

  const paused = pausedRemainingMs != null;

  // Detect reaching 0: trigger onEnd ONCE and play the beep if the preference
  // allows it. A paused rest never ends on its own, even at zero.
  useEffect(() => {
    if (!paused && !endedRef.current && now >= endsAt) {
      endedRef.current = true;
      playRestEndBeep();
      onEnd();
    }
  }, [now, endsAt, paused, onEnd]);

  const remainingMs = restRemainingMs({ endsAt, pausedRemainingMs }, now);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const progress = Math.min(100, (remainingMs / (totalSec * 1000)) * 100);

  // Ring: lime over the track, emptying as the rest runs out.
  const radius = 96;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.max(0, Math.min(1, progress / 100));

  return (
    <section className="flex flex-col items-center gap-5 rounded-lg border border-border bg-card px-4 py-6">
      <p className="text-caption text-muted-foreground">{paused ? t('pausedTitle') : t('title')}</p>

      <div className="relative flex size-[13.5rem] items-center justify-center">
        <svg viewBox="0 0 216 216" className="absolute inset-0 size-full -rotate-90" aria-hidden>
          <circle cx={108} cy={108} r={radius} fill="none" strokeWidth={10} className="stroke-track" />
          <circle
            cx={108}
            cy={108}
            r={radius}
            fill="none"
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
            className="stroke-primary transition-[stroke-dashoffset] duration-100 ease-linear motion-reduce:transition-none"
          />
        </svg>
        <p className="relative flex items-baseline gap-1 tabular-nums">
          <span data-testid="rest-remaining" className="text-timer">
            {remainingSec}
          </span>
          <span className="text-subtitle text-muted-foreground">{t('seconds')}</span>
        </p>
      </div>

      {nextLabel && (
        <p className="text-center text-caption text-muted-foreground">
          {t('next', { name: nextLabel })}
        </p>
      )}

      {recommendation && (
        <div className="w-full rounded-[18px] bg-suggestion p-3.5 text-center text-suggestion-foreground">
          <p className="text-small">{autoT('nextSet')}</p>
          <p className="mt-1 text-heading tabular-nums">
            {formatWeight(recommendation.weight, unit, {
              decimals: 2,
              group: false,
              locale,
            })}{' '}
            × {recommendation.reps} · RIR {recommendation.rir}
          </p>
          <p className="text-small">{autoT(`reasons.${recommendation.reason}`)}</p>
        </div>
      )}

      <div className="flex w-full gap-2">
        <Button
          variant="secondary"
          size="session"
          onClick={() => onAdjust(-REST_ADJUST_STEP_MS)}
          disabled={remainingMs <= 0}
          aria-label={t('removeFifteenLabel')}
          className="flex-1 px-2"
        >
          <MinusIcon />
          <span>{t('fifteen')}</span>
        </Button>
        <Button
          variant="secondary"
          size="session"
          onClick={paused ? onResume : onPause}
          className="flex-1 px-2"
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
          <span>{paused ? t('resume') : t('pause')}</span>
        </Button>
        <Button
          variant="secondary"
          size="session"
          onClick={() => onAdjust(REST_ADJUST_STEP_MS)}
          aria-label={t('addFifteenLabel')}
          className="flex-1 px-2"
        >
          <PlusIcon />
          <span>{t('fifteen')}</span>
        </Button>
      </div>
      <Button size="session" onClick={onSkip} className="w-full">
        <FastForwardIcon />
        <span>{t('skip')}</span>
      </Button>
    </section>
  );
}
