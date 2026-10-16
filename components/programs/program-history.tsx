'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { ArrowCounterClockwiseIcon } from '@/components/ui/icon';
import { toast } from 'sonner';
import type { ProgramRevisionSource } from '@/lib/prisma-client';
import type { ProgramDiff } from '@/lib/program-snapshot';
import { Button } from '@/components/ui/button';
import { textLinkClass } from '@/components/ui/section';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/screen-state';
import { Tag } from '@/components/ui/tag';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ProgramDiffView } from '@/components/programs/program-diff-view';
import { cn } from '@/lib/utils';

interface VersionRow {
  id: string;
  version: number;
  source: ProgramRevisionSource;
  summary: string | null;
  restoredFromVersion: number | null;
  createdAt: string;
  sessionCount: number;
}

interface VersionDetail {
  changesFromPrevious: ProgramDiff | null;
  changesToRestore: ProgramDiff;
}

// The program's versions (epic 1.6): what each one changed, what restoring
// it would change now, and the restore itself. Loaded on demand from the
// "Ver versões deste programa" link.
export function ProgramHistory({ programId }: { programId: string }) {
  const t = useTranslations('programs.history');
  const common = useTranslations('common');
  const format = useFormatter();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<VersionRow[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<VersionDetail | null>(null);
  const [confirming, setConfirming] = useState<VersionRow | null>(null);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const res = await fetch(`/api/programs/${encodeURIComponent(programId)}/revisions`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(String(res.status));
      setVersions((await res.json()) as VersionRow[]);
    } catch {
      setLoadFailed(true);
    }
  }, [programId]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) void load();
  }

  async function showDetail(version: VersionRow) {
    if (selected === version.id) {
      setSelected(null);
      setDetail(null);
      return;
    }
    setSelected(version.id);
    setDetail(null);
    try {
      const res = await fetch(
        `/api/programs/${encodeURIComponent(programId)}/revisions/${encodeURIComponent(version.id)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error(String(res.status));
      setDetail((await res.json()) as VersionDetail);
    } catch {
      toast.error(t('loadError'));
      setSelected(null);
    }
  }

  async function restore(version: VersionRow) {
    setRestoring(true);
    try {
      const res = await fetch(
        `/api/programs/${encodeURIComponent(programId)}/revisions/${encodeURIComponent(version.id)}/restore`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { missingExercises?: string[] } | null;
        toast.error(
          body?.missingExercises?.length
            ? t('restoreMissing', { names: body.missingExercises.join(', ') })
            : t('restoreError'),
        );
        return;
      }
      toast.success(t('restored', { version: version.version }));
      setConfirming(null);
      setSelected(null);
      setDetail(null);
      await load();
      router.refresh();
    } finally {
      setRestoring(false);
    }
  }

  function sourceLabel(version: VersionRow) {
    if (version.source === 'RESTORE') {
      return t('sources.RESTORE', { version: version.restoredFromVersion ?? '?' });
    }
    return t(`sources.${version.source}`);
  }

  const latestId = versions?.[0]?.id;

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="program-history-list"
        className={cn(textLinkClass, 'flex min-h-touch items-center self-start')}
      >
        {open ? t('hide') : t('show')}
      </button>

      {open && (
        <section id="program-history-list" aria-labelledby="program-history-title" className="flex flex-col">
          <h2 id="program-history-title" className="text-subtitle">
            {t('title')}
          </h2>
          <p className="pb-2 text-caption text-muted-foreground">{t('description')}</p>
          {loadFailed && <ErrorState message={t('loadError')} onRetry={() => void load()} />}
          {!versions && !loadFailed && (
            <div role="status" aria-label={t('loading')} className="flex flex-col">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex flex-col gap-1.5 border-t border-border py-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              ))}
            </div>
          )}
          {versions && (
            <ul>
              {versions.map((version) => {
                const isCurrent = version.id === latestId;
                const expanded = selected === version.id;
                return (
                  <li
                    key={version.id}
                    data-testid={`program-version-${version.version}`}
                    className="border-t border-border py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <p className="flex flex-wrap items-center gap-2 text-body font-semibold">
                          {t('version', { version: version.version })}
                          {isCurrent && <Tag variant="muted">{t('current')}</Tag>}
                        </p>
                        <p className="text-[0.8125rem] font-medium text-muted-foreground">
                          {sourceLabel(version)} ·{' '}
                          {format.dateTime(new Date(version.createdAt), {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                          {version.sessionCount > 0 &&
                            ` · ${t('usedBy', { count: version.sessionCount })}`}
                        </p>
                        {version.summary && (
                          <p className="text-caption text-pretty">{version.summary}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void showDetail(version)}
                        aria-expanded={expanded}
                        className="-mr-3 -mt-1.5 shrink-0"
                      >
                        {expanded ? t('closeDetails') : t('details')}
                      </Button>
                    </div>
                    {expanded && (
                      <div className="mt-3 flex flex-col gap-4">
                        {!detail ? (
                          <div role="status" aria-label={t('loading')} className="flex flex-col gap-1.5">
                            <Skeleton className="h-3 w-4/5" />
                            <Skeleton className="h-3 w-3/5" />
                          </div>
                        ) : (
                          <>
                            <section className="flex flex-col gap-1">
                              <h3 className="text-caption font-semibold">
                                {t('changesFromPrevious')}
                              </h3>
                              {detail.changesFromPrevious ? (
                                <ProgramDiffView diff={detail.changesFromPrevious} />
                              ) : (
                                <p className="text-caption text-muted-foreground">
                                  {t('firstVersion')}
                                </p>
                              )}
                            </section>
                            {!isCurrent && (
                              <section className="flex flex-col items-start gap-1">
                                <h3 className="text-caption font-semibold">
                                  {t('changesToRestore')}
                                </h3>
                                <ProgramDiffView diff={detail.changesToRestore} />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mt-2"
                                  onClick={() => setConfirming(version)}
                                >
                                  <ArrowCounterClockwiseIcon />
                                  {t('restore')}
                                </Button>
                              </section>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <AlertDialog open={confirming !== null} onOpenChange={(next) => !next && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('restoreTitle', { version: confirming?.version ?? 0 })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('restoreDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>{common('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={restoring}
              onClick={(event) => {
                event.preventDefault();
                if (confirming) void restore(confirming);
              }}
            >
              {restoring ? t('restoring') : t('restore')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
