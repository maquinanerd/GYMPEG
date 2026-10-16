'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CaretDownIcon } from '@/components/ui/icon';
import { Button, IconButton } from '@/components/ui/button';
import { Num } from '@/components/ui/num';
import { REST_ADJUST_STEP_MS, restRemainingMs } from '@/lib/rest-timer';
import { playRestEndBeep } from '@/lib/sound';
import { formatWeight } from '@/lib/units';
import type { WeightUnit } from '@/lib/prisma-client';
import type { IntraSetRecommendation } from '@/lib/intra-set-autoregulation';
import { formatClock } from '@/components/session/session-format';

interface Props {
  endsAt: number;
  // Milliseconds left when the rest was paused; null (or omitted) while it runs.
  pausedRemainingMs?: number | null;
  totalSec: number;
  // Name of the exercise that comes next, when the rest moves to another one.
  nextLabel: string | null | undefined;
  // The set that comes next on the same exercise ("set 3 of 3").
  nextSet?: { number: number; total: number } | null;
  // What was just logged, under the title ("Bench press · set 2 logged, 82.5 × 7").
  context?: string | null;
  recommendation?: IntraSetRecommendation | null;
  unit: WeightUnit;
  // The rest folded into a bar over the workout (the timer keeps running).
  minimized?: boolean;
  onMinimize?: () => void;
  onExpand?: () => void;
  onEnd: () => void;
  onSkip: () => void;
  onPause: () => void;
  onResume: () => void;
  // Signed change of the remaining time, in milliseconds (issue #393).
  onAdjust: (deltaMs: number) => void;
}

// The rest screen: the whole screen, with a lime block rising from the bottom
// whose height is the time left over the total (it drains with a 1s linear
// transition, none under reduced motion). The timer in the middle, the next
// set with its reason on the one white surface, then -15 s / pause / +15 s and
// "Skip rest", all 64px. Minimized, it folds into a bar over the workout.
export function RestTimer({
  endsAt,
  pausedRemainingMs = null,
  totalSec,
  nextLabel,
  nextSet = null,
  context = null,
  recommendation = null,
  unit,
  minimized = false,
  onMinimize,
  onExpand,
  onEnd,
  onSkip,
  onPause,
  onResume,
  onAdjust,
}: Props) {
  const t = useTranslations('session.rest');
  const autoT = useTranslations('session.autoregulation');
  const locale = useLocale();
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
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

  // The rest screen takes the focus when it opens (and when it is expanded
  // again), so the controls are next for keyboard and screen reader users.
  useEffect(() => {
    if (!minimized) dialogRef.current?.focus();
  }, [minimized]);

  const remainingMs = restRemainingMs({ endsAt, pausedRemainingMs }, now);
  const remainingSec = Math.ceil(remainingMs / 1000);
  // Running, the block heads for the value of the next whole second over the
  // 1s transition, so it drains continuously; paused, it holds.
  const fillSec = paused ? remainingSec : Math.max(0, remainingSec - 1);
  const fill = totalSec > 0 ? Math.min(1, fillSec / totalSec) : 0;
  const time = formatClock(remainingSec);

  if (minimized) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-2xl gap-2.5">
          <Button
            size="session"
            onClick={onExpand}
            aria-label={`${t('show')}: ${time}`}
            className="min-w-0 flex-1"
          >
            <span role="timer" aria-live="off" className="tabular-nums">
              {t('resting', { time })}
            </span>
          </Button>
          <Button variant="outline" size="session" onClick={onSkip}>
            {t('skip')}
          </Button>
        </div>
      </div>
    );
  }

  const nextHeading = nextSet
    ? t('nextSet', { number: nextSet.number, total: nextSet.total })
    : nextLabel
      ? t('next', { name: nextLabel })
      : null;

  return (
    <section
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="fixed inset-0 z-40 overflow-hidden bg-background focus:outline-none"
    >
      <div
        aria-hidden="true"
        data-testid="rest-fill"
        className="absolute inset-x-0 bottom-0 bg-primary transition-[height] duration-1000 ease-linear motion-reduce:transition-none"
        style={{ height: `${(fill * 100).toFixed(2)}%` }}
      />
      <div className="relative mx-auto flex h-full max-w-2xl flex-col pt-[env(safe-area-inset-top)]">
        <header className="flex items-center gap-1 px-2 py-1">
          {onMinimize && (
            <IconButton onClick={onMinimize} aria-label={t('back')} title={t('back')}>
              <CaretDownIcon />
            </IconButton>
          )}
          <div className={onMinimize ? 'flex min-w-0 flex-col' : 'flex min-w-0 flex-col pl-3'}>
            <h2 id={titleId} className="text-subtitle">
              {t('title')}
            </h2>
            {context && (
              <p className="truncate text-[0.8125rem] font-medium text-muted-foreground">
                {context}
              </p>
            )}
          </div>
        </header>

        <div
          role="timer"
          aria-live="off"
          className="flex flex-1 flex-col items-center justify-center gap-1"
        >
          <Num stretch={108} data-testid="rest-remaining" className="text-timer">
            {time}
          </Num>
          <span className="text-body font-semibold text-muted-foreground">
            {paused ? t('pausedTitle') : t('of', { total: formatClock(totalSec) })}
          </span>
        </div>

        <div className="flex flex-col gap-2.5 px-5 pb-[calc(2.125rem+env(safe-area-inset-bottom))]">
          {(nextHeading || recommendation) && (
            <div className="flex flex-col gap-1 rounded-md bg-card px-4 py-3.5 text-card-foreground">
              {nextHeading && (
                <span className="text-[0.8125rem] font-semibold text-muted-foreground">
                  {nextHeading}
                </span>
              )}
              {recommendation && (
                <>
                  <Num stretch={118} className="text-number">
                    {formatWeight(recommendation.weight, unit, {
                      decimals: 2,
                      group: false,
                      locale,
                    })}{' '}
                    × {recommendation.reps} · RIR {recommendation.rir}
                  </Num>
                  <span className="text-caption leading-[1.4] text-muted-foreground">
                    {autoT(`reasons.${recommendation.reason}`)}
                  </span>
                </>
              )}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2.5">
            <Button
              variant="secondary"
              size="session"
              onClick={() => onAdjust(-REST_ADJUST_STEP_MS)}
              disabled={remainingMs <= 0}
              aria-label={t('removeFifteenLabel')}
              className="px-2 tabular-nums"
            >
              {t('minusFifteen')}
            </Button>
            <Button
              variant="secondary"
              size="session"
              onClick={paused ? onResume : onPause}
              className="px-2"
            >
              {paused ? t('resume') : t('pause')}
            </Button>
            <Button
              variant="secondary"
              size="session"
              onClick={() => onAdjust(REST_ADJUST_STEP_MS)}
              aria-label={t('addFifteenLabel')}
              className="px-2 tabular-nums"
            >
              {t('plusFifteen')}
            </Button>
          </div>
          <Button variant="ink" size="session" onClick={onSkip} className="w-full">
            {t('skip')}
          </Button>
        </div>
      </div>
    </section>
  );
}
