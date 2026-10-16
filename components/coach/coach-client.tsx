'use client';

import { useId, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { CoachText } from '@/components/ui/coach-text';
import { ErrorState, OfflineNotice } from '@/components/ui/screen-state';
import { Tag } from '@/components/ui/tag';
import { useOnline } from '@/components/auth/use-online';
import { extractAdjustments } from '@/lib/coach-adjustments';
import { cn } from '@/lib/utils';
import { CoachMarkdown } from './coach-markdown';
import { KeyMissingNotice } from './key-missing-notice';
import { ProposedAdjustments } from './proposed-adjustments';

interface DebriefItem {
  id: string;
  weekStart: string;
  weekEnd: string;
  response: string;
  appliedAt: string | null;
  createdAt: string;
}

export interface ProgramExerciseDefaults {
  targetRepsMin: number;
  targetRepsMax: number;
  targetSets: number;
  targetRIR: number;
  restSec: number;
}

interface Props {
  initialHistory: DebriefItem[];
  hasApiKey: boolean;
  providerLabel: string;
  apiKeyEnvVar: string;
  programDefaults: Record<string, ProgramExerciseDefaults>;
}

// "Análises semanais": the weekly debriefs, newest first, each a row with
// its week, date and the coach's first line; the open one shows the whole
// text and the adjustments it proposes.
export function CoachClient({
  initialHistory,
  hasApiKey,
  providerLabel,
  apiKeyEnvVar,
  programDefaults,
}: Props) {
  const t = useTranslations('coach');
  const online = useOnline();
  const headingId = useId();
  const [history, setHistory] = useState(initialHistory);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(initialHistory[0]?.id ?? null);

  async function requestDebrief() {
    setPending(true);
    setFailed(false);
    try {
      const res = await fetch('/api/coach', { method: 'POST' });
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as { id: string; response: string; createdAt: string };
      const newItem: DebriefItem = {
        id: j.id,
        weekStart: new Date().toISOString(),
        weekEnd: new Date().toISOString(),
        response: j.response,
        appliedAt: null,
        createdAt: j.createdAt,
      };
      setHistory((h) => [newItem, ...h]);
      setActiveId(newItem.id);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  const canGenerate = hasApiKey && online && !pending;

  return (
    <section aria-labelledby={headingId} className="flex flex-col">
      <div className="flex items-center justify-between gap-3 pb-1.5">
        <h2 id={headingId} className="text-subtitle">
          {t('client.title')}
        </h2>
        <Button
          type="button"
          variant="ink"
          size="sm"
          className="h-11"
          onClick={requestDebrief}
          loading={pending}
          disabled={!canGenerate}
        >
          {pending ? t('client.generating') : t('client.generate')}
        </Button>
      </div>

      {!hasApiKey && (
        <KeyMissingNotice
          title={t('client.keyMissing', { provider: providerLabel })}
          hint={t('client.keySetup', { variable: apiKeyEnvVar })}
        />
      )}
      {!online && <OfflineNotice className="mb-2">{t('offline')}</OfflineNotice>}
      {failed && <ErrorState message={t('client.error')} onRetry={requestDebrief} />}

      {history.length === 0 ? (
        <p className="border-t border-border py-4 text-caption text-muted-foreground text-pretty">
          {t('client.empty')}
        </p>
      ) : (
        <ul>
          {history.map((item) => (
            <DebriefRow
              key={item.id}
              item={item}
              open={item.id === activeId}
              onToggle={() => setActiveId((id) => (id === item.id ? null : item.id))}
              programDefaults={programDefaults}
              onApplied={(appliedAt) =>
                setHistory((h) => h.map((d) => (d.id === item.id ? { ...d, appliedAt } : d)))
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function DebriefRow({
  item,
  open,
  onToggle,
  programDefaults,
  onApplied,
}: {
  item: DebriefItem;
  open: boolean;
  onToggle: () => void;
  programDefaults: Record<string, ProgramExerciseDefaults>;
  onApplied: (appliedAt: string) => void;
}) {
  const t = useTranslations('coach');
  const format = useFormatter();
  const panelId = useId();
  const { cleaned, adjustments, parseErrors } = extractAdjustments(item.response);

  return (
    <li className="border-t border-border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full flex-col gap-1 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="flex w-full items-baseline justify-between gap-2">
          <span className="text-body font-semibold">
            {t('client.weekOf', {
              date: format.dateTime(new Date(item.weekStart), { day: '2-digit', month: '2-digit' }),
            })}
          </span>
          <span className="shrink-0 text-[0.8125rem] font-medium text-muted-foreground">
            {format.dateTime(new Date(item.createdAt), {
              weekday: 'short',
              day: '2-digit',
              month: '2-digit',
            })}
          </span>
        </span>
        {!open && (
          <span className="line-clamp-2 text-caption font-medium italic text-muted-foreground">
            {firstNonEmptyLine(cleaned)}
          </span>
        )}
        {item.appliedAt ? (
          <Tag className="mt-1">{t('client.applied')}</Tag>
        ) : (
          adjustments.length > 0 && (
            <Tag variant="primary" className="mt-1">
              {t('client.suggested', { count: adjustments.length })}
            </Tag>
          )
        )}
      </button>

      <div id={panelId} hidden={!open} className={cn('flex-col gap-4 pb-5', open && 'flex')}>
        {open && (
          <>
            <CoachText>
              <CoachMarkdown>{cleaned}</CoachMarkdown>
            </CoachText>
            {parseErrors.length > 0 && (
              <p className="text-caption text-muted-foreground">{t('client.unreadable')}</p>
            )}
            {adjustments.length > 0 && (
              <ProposedAdjustments
                debriefId={item.id}
                adjustments={adjustments}
                programDefaults={programDefaults}
                appliedAt={item.appliedAt}
                onApplied={onApplied}
              />
            )}
          </>
        )}
      </div>
    </li>
  );
}

function firstNonEmptyLine(text: string): string {
  for (const line of text.split('\n')) {
    const trimmed = line.replace(/^[#>*-]+\s*/, '').trim();
    if (trimmed) return trimmed;
  }
  return text.slice(0, 120);
}
