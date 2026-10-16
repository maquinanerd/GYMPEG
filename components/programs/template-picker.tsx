'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import type { ProgramTemplate } from '@/lib/programs/templates';

interface Props {
  templates: ProgramTemplate[];
}

// "Start from a template" picker. Materializes the selected template into a
// real Program through the same /api/programs/from-template route the AI generator
// uses, so the structure is persisted exactly as written and the coach treats
// it like any user-authored program. Each template is anchored by its slug,
// so the Programas chips land on it.
export function TemplatePicker({ templates }: Props) {
  const t = useTranslations('programs');
  const router = useRouter();
  const [creatingSlug, setCreatingSlug] = useState<string | null>(null);

  async function instantiate(template: ProgramTemplate) {
    setCreatingSlug(template.slug);
    try {
      const res = await fetch('/api/programs/from-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template.program),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      const j = (await res.json()) as { id: string };
      toast.success(t('templateCreated'));
      router.push(`/programs/${j.id}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('createError'));
      setCreatingSlug(null);
    }
  }

  return (
    <ul className="border-b border-border">
      {templates.map((template) => {
        const dayCount = template.program.workouts.length;
        return (
          <li
            key={template.slug}
            id={template.slug}
            className="flex scroll-mt-4 flex-col gap-2 border-t border-border py-4"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-subtitle">{template.name}</h2>
              <Tag variant="muted">{t('dayCount', { count: dayCount })}</Tag>
            </div>
            <p className="text-caption text-pretty">{template.summary}</p>
            <p className="text-[0.8125rem] font-medium text-muted-foreground text-pretty">
              {template.attribution}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1 self-start"
              disabled={creatingSlug !== null}
              loading={creatingSlug === template.slug}
              onClick={() => instantiate(template)}
            >
              {creatingSlug === template.slug ? t('creating') : t('templateUse')}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
