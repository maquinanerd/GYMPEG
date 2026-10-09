'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { History, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import type { ProgramRevisionSource } from '@/lib/prisma-client';
import type { ProgramDiff } from '@/lib/program-snapshot';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
// it would change now, and the restore itself. Loaded on demand.
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
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4" />
              {t('title')}
            </CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={toggle}
            aria-expanded={open}
            aria-controls="program-history-list"
            className="min-h-tap shrink-0"
          >
            {open ? t('hide') : t('show')}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent id="program-history-list" className="flex flex-col gap-3">
          {loadFailed && <p className="text-sm text-destructive">{t('loadError')}</p>}
          {!versions && !loadFailed && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('loading')}
            </p>
          )}
          {versions?.map((version) => {
            const isCurrent = version.id === latestId;
            const expanded = selected === version.id;
            return (
              <div
                key={version.id}
                data-testid={`program-version-${version.version}`}
                className="rounded-md border border-border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {t('version', { version: version.version })}
                      {isCurrent && <Badge variant="secondary">{t('current')}</Badge>}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {sourceLabel(version)} ·{' '}
                      {format.dateTime(new Date(version.createdAt), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                      {version.sessionCount > 0 &&
                        ` · ${t('usedBy', { count: version.sessionCount })}`}
                    </p>
                    {version.summary && <p className="text-sm">{version.summary}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void showDetail(version)}
                    aria-expanded={expanded}
                    className="min-h-tap"
                  >
                    {expanded ? t('closeDetails') : t('details')}
                  </Button>
                </div>
                {expanded && (
                  <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
                    {!detail ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <section>
                          <h3 className="mb-1 text-sm font-semibold">{t('changesFromPrevious')}</h3>
                          {detail.changesFromPrevious ? (
                            <ProgramDiffView diff={detail.changesFromPrevious} />
                          ) : (
                            <p className="text-sm text-muted-foreground">{t('firstVersion')}</p>
                          )}
                        </section>
                        {!isCurrent && (
                          <section>
                            <h3 className="mb-1 text-sm font-semibold">{t('changesToRestore')}</h3>
                            <ProgramDiffView diff={detail.changesToRestore} />
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-3 min-h-tap"
                              onClick={() => setConfirming(version)}
                            >
                              <RotateCcw className="size-4" />
                              <span className="ml-2">{t('restore')}</span>
                            </Button>
                          </section>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
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
    </Card>
  );
}
