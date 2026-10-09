'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { Program } from '@/lib/prisma-client';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { programInputSchema, type ProgramInput } from '@/lib/schemas/program';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program: Program;
}

function formValues(program: Program): ProgramInput {
  return {
    name: program.name,
    phase: program.phase,
    description: program.description ?? '',
    scheduleMode: program.scheduleMode,
  };
}

export function ProgramEditDialog({ open, onOpenChange, program }: Props) {
  const t = useTranslations('programs');
  const common = useTranslations('common');
  const router = useRouter();
  const form = useForm<ProgramInput>({
    resolver: zodResolver(programInputSchema),
    defaultValues: formValues(program),
  });

  useEffect(() => {
    if (open) form.reset(formValues(program));
  }, [open, program, form]);

  async function onSubmit(values: ProgramInput) {
    const res = await fetch(`/api/programs/${program.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, description: values.description || null }),
    });
    if (!res.ok) {
      toast.error(t('saveError'));
      return;
    }
    toast.success(t('updated'));
    onOpenChange(false);
    router.refresh();
  }

  const scheduleMode = form.watch('scheduleMode');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('editProgram')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="name">{common('fields.name')}</Label>
            <Input id="name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phase">{t('phase')}</Label>
            <Input id="phase" {...form.register('phase')} />
            {form.formState.errors.phase && (
              <p className="text-sm text-destructive">{form.formState.errors.phase.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="scheduleMode">{t('schedule.label')}</Label>
            <Controller
              control={form.control}
              name="scheduleMode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="scheduleMode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ROTATION">{t('schedule.ROTATION')}</SelectItem>
                    <SelectItem value="FIXED_DAYS">{t('schedule.FIXED_DAYS')}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">
              {scheduleMode === 'FIXED_DAYS' ? t('schedule.fixedHint') : t('schedule.rotationHint')}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{common('fields.description')}</Label>
            <Textarea id="description" rows={3} {...form.register('description')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {common('actions.cancel')}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? common('actions.saving') : common('actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
