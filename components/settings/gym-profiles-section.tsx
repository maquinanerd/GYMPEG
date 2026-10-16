'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PlusIcon } from '@/components/ui/icon';
import { toast } from 'sonner';
import type { Exercise, Gym, GymExerciseConfig } from '@/lib/prisma-client';
import { Button, IconButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useExerciseName } from '@/components/shared/use-exercise-name';
import { matchesExerciseQuery } from '@/lib/catalog/search-index';
import { SettingsHeading } from './settings-ui';

type GymWithConfigs = Gym & { exerciseConfigs: GymExerciseConfig[] };

interface Props {
  initialGyms: GymWithConfigs[];
  activeGymId: string | null;
  exercises: Exercise[];
}

interface Draft {
  id: string | null;
  name: string;
  dumbbellWeights: number[];
  plateWeights: number[];
  barWeights: number[];
  configs: Map<string, { isAvailable: boolean; weightOptions: number[] }>;
}

export function GymProfilesSection({ initialGyms, activeGymId: initialActive, exercises }: Props) {
  const t = useTranslations('settings.gyms');
  const common = useTranslations('common');
  const exerciseName = useExerciseName();
  const router = useRouter();
  const [gyms, setGyms] = useState(initialGyms);
  const [activeGymId, setActiveGymId] = useState(initialActive);
  const [selectedId, setSelectedId] = useState(initialActive ?? initialGyms[0]?.id ?? 'new');
  const [draft, setDraft] = useState<Draft>(() =>
    draftFromGym(initialGyms.find((g) => g.id === selectedId)),
  );
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredExercises = useMemo(() => {
    if (!search.trim()) return exercises;
    return exercises.filter((exercise) =>
      matchesExerciseQuery(exercise.name, exerciseName(exercise.name), search),
    );
  }, [exerciseName, exercises, search]);

  function selectGym(id: string) {
    setSelectedId(id);
    setDraft(draftFromGym(gyms.find((gym) => gym.id === id)));
  }

  function updateConfig(
    exerciseId: string,
    next: Partial<{ isAvailable: boolean; weightOptions: number[] }>,
  ) {
    setDraft((current) => {
      const configs = new Map(current.configs);
      const previous = configs.get(exerciseId) ?? { isAvailable: true, weightOptions: [] };
      configs.set(exerciseId, { ...previous, ...next });
      return { ...current, configs };
    });
  }

  async function save() {
    if (!draft.name.trim() || saving) return;
    setSaving(true);
    try {
      const body = {
        name: draft.name.trim(),
        dumbbellWeights: draft.dumbbellWeights,
        plateWeights: draft.plateWeights,
        barWeights: draft.barWeights,
        exerciseConfigs: [...draft.configs.entries()].flatMap(([exerciseId, config]) =>
          !config.isAvailable || config.weightOptions.length > 0 ? [{ exerciseId, ...config }] : [],
        ),
        ...(draft.id ? {} : { makeActive: true }),
      };
      const res = await fetch(draft.id ? `/api/gyms/${draft.id}` : '/api/gyms', {
        method: draft.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const saved = (await res.json()) as GymWithConfigs;
      setGyms((current) => [...current.filter((gym) => gym.id !== saved.id), saved].sort(byName));
      setSelectedId(saved.id);
      setDraft(draftFromGym(saved));
      if (!draft.id) setActiveGymId(saved.id);
      toast.success(t('saved'));
      router.refresh();
    } catch {
      toast.error(t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function activate() {
    if (!draft.id || draft.id === activeGymId) return;
    const res = await fetch(`/api/gyms/${draft.id}/activate`, { method: 'POST' });
    if (!res.ok) {
      toast.error(t('activateError'));
      return;
    }
    setActiveGymId(draft.id);
    toast.success(t('activated'));
    router.refresh();
  }

  async function remove() {
    if (!draft.id) return;
    const deletedId = draft.id;
    const res = await fetch(`/api/gyms/${deletedId}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error(t('deleteError'));
      return;
    }
    const remaining = gyms.filter((gym) => gym.id !== deletedId);
    const next = remaining[0];
    setGyms(remaining);
    setActiveGymId(activeGymId === deletedId ? (next?.id ?? null) : activeGymId);
    setSelectedId(next?.id ?? 'new');
    setDraft(draftFromGym(next));
    toast.success(t('deleted'));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
        <div className="flex items-end gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label className={LABEL}>{t('savedGyms')}</Label>
            <Select value={selectedId} onValueChange={selectGym}>
              <SelectTrigger aria-label={t('savedGyms')}>
                <SelectValue placeholder={t('newGym')} />
              </SelectTrigger>
              <SelectContent>
                {gyms.map((gym) => (
                  <SelectItem key={gym.id} value={gym.id}>
                    {gym.name}
                    {gym.id === activeGymId ? ` (${t('active')})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <IconButton
            type="button"
            tone="outline"
            onClick={() => selectGym('new')}
            aria-label={t('newGym')}
          >
            <PlusIcon />
          </IconButton>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gym-name" className={LABEL}>
            {t('name')}
          </Label>
          <Input
            id="gym-name"
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder={t('namePlaceholder')}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <WeightListField
            id="gym-dumbbells"
            label={t('dumbbells')}
            values={draft.dumbbellWeights}
            placeholder="10, 12, 14, 15, 16, 19"
            onChange={(values) => setDraft((current) => ({ ...current, dumbbellWeights: values }))}
          />
          <WeightListField
            id="gym-plates"
            label={t('plates')}
            values={draft.plateWeights}
            placeholder="1.25, 2.5, 5, 10, 15, 20"
            onChange={(values) => setDraft((current) => ({ ...current, plateWeights: values }))}
          />
          <WeightListField
            id="gym-bars"
            label={t('bars')}
            values={draft.barWeights}
            placeholder="20"
            onChange={(values) => setDraft((current) => ({ ...current, barWeights: values }))}
          />
        </div>

        <section className="flex flex-col gap-3 border-t border-border pt-5">
          <SettingsHeading description={t('exerciseAvailabilityDescription')}>
            {t('exerciseAvailability')}
          </SettingsHeading>
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('searchExercises')}
            aria-label={t('searchExercises')}
          />
          <ul className="max-h-96 overflow-y-auto border-b border-border">
            {filteredExercises.map((exercise) => {
              const config = draft.configs.get(exercise.id) ?? {
                isAvailable: true,
                weightOptions: [],
              };
              const hasStack =
                exercise.equipmentType === 'MACHINE' || exercise.equipmentType === 'CABLE';
              return (
                <li key={exercise.id} className="flex flex-col gap-2 border-t border-border py-3">
                  <div className="flex min-h-11 items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-body font-semibold">
                      {exerciseName(exercise.name)}
                    </span>
                    <label className="flex shrink-0 items-center gap-2 text-caption text-muted-foreground">
                      {t('available')}
                      <Switch
                        checked={config.isAvailable}
                        onCheckedChange={(isAvailable) =>
                          updateConfig(exercise.id, { isAvailable })
                        }
                      />
                    </label>
                  </div>
                  {hasStack && config.isAvailable && (
                    <WeightListField
                      id={`weights-${exercise.id}`}
                      label={t('machineWeights')}
                      values={config.weightOptions}
                      placeholder="5, 10, 15, 20, 25"
                      onChange={(weightOptions) => updateConfig(exercise.id, { weightOptions })}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <div className="flex flex-wrap justify-between gap-2">
          <div>
            {draft.id && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" className="text-destructive-text">
                    {common('actions.delete')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('deleteDescription', { name: draft.name })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{common('actions.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={remove}>
                      {common('actions.delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <div className="flex gap-2">
            {draft.id && draft.id !== activeGymId && (
              <Button type="button" variant="outline" onClick={activate}>
                {t('makeActive')}
              </Button>
            )}
            <Button
              type="button"
              onClick={save}
              loading={saving}
              disabled={!draft.name.trim() || saving}
            >
              {saving ? common('actions.saving') : common('actions.save')}
            </Button>
          </div>
        </div>
    </div>
  );
}

const LABEL = 'text-caption font-semibold';

function WeightListField({
  id,
  label,
  values,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  values: number[];
  placeholder: string;
  onChange: (values: number[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-small text-muted-foreground">
        {label}
      </Label>
      <Input
        key={`${id}-${values.join(',')}`}
        id={id}
        defaultValue={values.join(', ')}
        placeholder={placeholder}
        inputMode="decimal"
        onBlur={(event) => onChange(parseWeightList(event.target.value))}
      />
    </div>
  );
}

function parseWeightList(raw: string): number[] {
  return [
    ...new Set(
      raw
        .split(/[;,]/)
        .map((value) => Number(value.trim().replace(',', '.')))
        .filter((value) => Number.isFinite(value) && value > 0)
        .map((value) => Math.round(value * 100) / 100),
    ),
  ].sort((a, b) => a - b);
}

function draftFromGym(gym?: GymWithConfigs): Draft {
  return {
    id: gym?.id ?? null,
    name: gym?.name ?? '',
    dumbbellWeights: gym?.dumbbellWeights ?? [],
    plateWeights: gym?.plateWeights ?? [],
    barWeights: gym?.barWeights ?? [],
    configs: new Map(
      gym?.exerciseConfigs.map((config) => [
        config.exerciseId,
        { isAvailable: config.isAvailable, weightOptions: config.weightOptions },
      ]) ?? [],
    ),
  };
}

function byName(a: GymWithConfigs, b: GymWithConfigs) {
  return a.name.localeCompare(b.name);
}
