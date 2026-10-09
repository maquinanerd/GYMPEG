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
import { cycleWeekAt, MAX_CYCLE_WEEKS, MIN_CYCLE_WEEKS, programCycle } from '@/lib/program-cycle';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program: Program;
}

const CYCLE_LENGTHS = Array.from(
  { length: MAX_CYCLE_WEEKS - MIN_CYCLE_WEEKS + 1 },
  (_, index) => MIN_CYCLE_WEEKS + index,
);

// The device's zone stands in for the account's: both are the lifter's.
function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function formValues(program: Program): ProgramInput {
  const cycle = programCycle(program);
  return {
    name: program.name,
    phase: program.phase,
    description: program.description ?? '',
    scheduleMode: program.scheduleMode,
    cycleWeeks: program.cycleWeeks,
    cycleDeloadWeek: program.cycleDeloadWeek,
    cycleCurrentWeek: cycle ? cycleWeekAt(cycle, new Date(), browserTimeZone()) : 1,
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
    const cycle = values.cycleWeeks
      ? {
          cycleWeeks: values.cycleWeeks,
          cycleDeloadWeek: values.cycleDeloadWeek ?? null,
          cycleCurrentWeek: Math.min(values.cycleCurrentWeek ?? 1, values.cycleWeeks),
        }
      : { cycleWeeks: null };
    const res = await fetch(`/api/programs/${program.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: values.name,
        phase: values.phase,
        description: values.description || null,
        scheduleMode: values.scheduleMode,
        ...cycle,
      }),
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
  const cycleWeeks = form.watch('cycleWeeks');
  const cycleDeloadWeek = form.watch('cycleDeloadWeek');
  const cycleWeekNumbers = cycleWeeks
    ? Array.from({ length: cycleWeeks }, (_, index) => index + 1)
    : [];

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
            <Label htmlFor="cycleWeeks">{t('cycle.label')}</Label>
            <Controller
              control={form.control}
              name="cycleWeeks"
              render={({ field }) => (
                <Select
                  value={field.value ? String(field.value) : 'none'}
                  onValueChange={(value) => {
                    const weeks = value === 'none' ? null : Number(value);
                    field.onChange(weeks);
                    // Keep the deload and current weeks inside a shorter cycle.
                    if (weeks && (form.getValues('cycleDeloadWeek') ?? 0) > weeks) {
                      form.setValue('cycleDeloadWeek', weeks);
                    }
                    if (weeks && (form.getValues('cycleCurrentWeek') ?? 1) > weeks) {
                      form.setValue('cycleCurrentWeek', 1);
                    }
                  }}
                >
                  <SelectTrigger id="cycleWeeks">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('cycle.none')}</SelectItem>
                    {CYCLE_LENGTHS.map((weeks) => (
                      <SelectItem key={weeks} value={String(weeks)}>
                        {t('cycle.weeks', { count: weeks })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {cycleWeeks ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="cycleCurrentWeek" className="text-xs">
                    {t('cycle.currentWeek')}
                  </Label>
                  <Controller
                    control={form.control}
                    name="cycleCurrentWeek"
                    render={({ field }) => (
                      <Select
                        value={String(field.value ?? 1)}
                        onValueChange={(value) => field.onChange(Number(value))}
                      >
                        <SelectTrigger id="cycleCurrentWeek">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {cycleWeekNumbers.map((week) => (
                            <SelectItem key={week} value={String(week)}>
                              {t('cycle.week', { week })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cycleDeloadWeek" className="text-xs">
                    {t('cycle.deloadWeek')}
                  </Label>
                  <Controller
                    control={form.control}
                    name="cycleDeloadWeek"
                    render={({ field }) => (
                      <Select
                        value={field.value ? String(field.value) : 'none'}
                        onValueChange={(value) =>
                          field.onChange(value === 'none' ? null : Number(value))
                        }
                      >
                        <SelectTrigger id="cycleDeloadWeek">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t('cycle.noDeload')}</SelectItem>
                          {cycleWeekNumbers.map((week) => (
                            <SelectItem key={week} value={String(week)}>
                              {t('cycle.week', { week })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {cycleWeeks
                ? cycleDeloadWeek
                  ? t('cycle.hintDeload', { count: cycleWeeks })
                  : t('cycle.hint', { count: cycleWeeks })
                : t('cycle.noneHint')}
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
