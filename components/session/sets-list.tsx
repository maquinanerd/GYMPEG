'use client';

import { useTranslations } from 'next-intl';
import { CloudArrowUpIcon, CloudSlashIcon, TrashIcon } from '@/components/ui/icon';
import type { Exercise, ProgramExercise } from '@/lib/prisma-client';
import { IconButton } from '@/components/ui/button';
import { Num } from '@/components/ui/num';
import { Tag } from '@/components/ui/tag';
import type { PendingSet } from '@/lib/indexeddb';
import { detectPRs, type PRType } from '@/lib/records';
import { formatCardioSet } from '@/lib/cardio';
import { cn } from '@/lib/utils';

interface Props {
  programExercise: ProgramExercise & { exercise: Exercise };
  sets: PendingSet[];
  isInputActive: boolean;
  onDeleteSet: (set: PendingSet) => void;
  // Prior (previous-session) non-warmup sets for this exercise, used as the
  // baseline for PR detection. Optional: absent on the very first session.
  // This is the most recent session's data (from getLastPerformances), so a
  // badge means "beats your last session" rather than an all-time record - an
  // all-time baseline would need a separate query and is out of scope here.
  priorSets?: { weight: number; reps: number }[];
}

const PR_LABEL_KEYS = { weight: 'weightPr', e1rm: 'oneRmPr' } as const;
const PR_TITLE_KEYS = { weight: 'weightPrTitle', e1rm: 'oneRmPrTitle' } as const;

// The logged sets of a cardio exercise (and the ones still to do) as a list
// on hairlines: set number, the duration/distance in the number style, a
// sync mark while it is not on the server yet and the delete button. The
// current set is the lit row.
export function SetsList({ programExercise, sets, isInputActive, onDeleteSet, priorSets }: Props) {
  const t = useTranslations('session.setsList');
  const completedNonWarmup = sets.filter((s) => !s.isWarmup);
  const totalRows = Math.max(programExercise.targetSets, completedNonWarmup.length + 1);
  const currentSetNumber = completedNonWarmup.length + 1;

  // PR detection runs on read against a baseline of the previous session plus
  // any earlier sets already logged in this session, so a second set only
  // counts as a PR if it beats the first one too.
  const baseline = (priorSets ?? []).map((s) => ({ ...s, isWarmup: false }));

  function prsFor(set: PendingSet, index: number): PRType[] {
    if (set.isWarmup) return [];
    const earlierThisSession = sets
      .slice(0, index)
      .filter((s) => !s.isWarmup)
      .map((s) => ({ weight: s.weight, reps: s.reps, isWarmup: false }));
    return detectPRs(set, [...baseline, ...earlierThisSession]);
  }

  return (
    <div className="flex flex-col">
      <ol className="border-b border-border">
        {sets.map((s, i) => (
          <RowDone key={s.localId} set={s} prs={prsFor(s, i)} onDelete={() => onDeleteSet(s)} />
        ))}

        {Array.from({ length: totalRows - sets.length }, (_, i) => {
          const setNum = completedNonWarmup.length + 1 + i;
          const isCurrent = i === 0 && isInputActive;
          return (
            <li
              key={`upcoming-${setNum}`}
              className={cn(
                'flex min-h-14 items-center gap-3 border-t border-border px-3 text-caption',
                isCurrent ? 'bg-row-current font-semibold' : 'text-muted-foreground',
              )}
            >
              {isCurrent ? t('current', { number: setNum }) : t('upcoming', { number: setNum })}
            </li>
          );
        })}
      </ol>

      {!isInputActive && completedNonWarmup.length === 0 && sets.length === 0 && (
        <p className="px-3 py-2 text-small text-muted-foreground">
          {t('noneDuringRest', { number: currentSetNumber })}
        </p>
      )}
    </div>
  );
}

function RowDone({ set, prs, onDelete }: { set: PendingSet; prs: PRType[]; onDelete: () => void }) {
  const t = useTranslations('session.setsList');
  const weightLabel = set.weight === 0 ? t('bodyweight') : `${set.weight} kg`;
  // Cardio sets (issue #133) render as duration/distance, never weight x reps.
  const isCardio = set.durationSec != null;
  return (
    <li className="flex min-h-16 items-center justify-between gap-2 border-t border-border pl-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="text-caption font-semibold">
          {t('set', { number: set.setNumber })}
          {set.isWarmup ? t('warmup') : ''}
          {set.isDropSet ? t('drop') : ''}
        </span>
        <Num stretch={112} className="text-body">
          {isCardio ? (
            formatCardioSet(set.durationSec!, set.distanceM)
          ) : (
            <>
              {weightLabel} × {set.reps}
              {set.rir != null && ` · RIR ${set.rir}`}
            </>
          )}
        </Num>
        {prs.map((pr) => (
          <Tag key={pr} variant="pr" title={t(PR_TITLE_KEYS[pr])}>
            {t(PR_LABEL_KEYS[pr])}
          </Tag>
        ))}
        {set.notes && <Tag variant="muted">{t('note')}</Tag>}
        <SyncMark status={set.status} />
      </div>
      <IconButton
        size="session"
        onClick={onDelete}
        aria-label={t('delete')}
        title={t('delete')}
        className="text-muted-foreground hover:text-destructive-text"
      >
        <TrashIcon />
      </IconButton>
    </li>
  );
}

// Only a set that is not on the server yet carries a mark: waiting (pending,
// syncing) or refused (failed). A synced set needs none.
function SyncMark({ status }: { status: PendingSet['status'] }) {
  if (status === 'synced') return null;
  if (status === 'failed')
    return <CloudSlashIcon weight="bold" className="size-4 shrink-0 text-destructive-text" />;
  return <CloudArrowUpIcon weight="bold" className="size-4 shrink-0 text-muted-foreground" />;
}
