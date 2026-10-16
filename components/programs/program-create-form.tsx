'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { programInputSchema, type ProgramInput } from '@/lib/schemas/program';

export function ProgramCreateForm() {
  const t = useTranslations('programs');
  const router = useRouter();
  const form = useForm<ProgramInput>({
    resolver: zodResolver(programInputSchema),
    defaultValues: { name: '', phase: 'Hypertrophy', description: '' },
  });

  async function onSubmit(values: ProgramInput) {
    const res = await fetch('/api/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, description: values.description || null }),
    });
    if (!res.ok) {
      toast.error(t('createError'));
      return;
    }
    const created = (await res.json()) as { id: string };
    toast.success(t('created'));
    router.push(`/programs/${created.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t('programName')}</Label>
        <Input id="name" placeholder={t('programNamePlaceholder')} {...form.register('name')} />
        {form.formState.errors.name && (
          <p className="text-caption text-destructive-text">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="phase">{t('phase')}</Label>
        <Input id="phase" placeholder={t('phasePlaceholder')} {...form.register('phase')} />
        {form.formState.errors.phase && (
          <p className="text-caption text-destructive-text">{form.formState.errors.phase.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">{t('descriptionOptional')}</Label>
        <Textarea id="description" rows={3} {...form.register('description')} />
      </div>

      <Button
        type="submit"
        className="mt-2 w-full"
        loading={form.formState.isSubmitting}
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? t('creating') : t('createProgram')}
      </Button>
    </form>
  );
}
