'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CaretLeftIcon, PlusIcon, XIcon } from '@/components/ui/icon';
import { toast } from 'sonner';
import type {
  MuscleGroup,
  Sex,
  TrainingExperience,
  TrainingGoal,
  WeightUnit,
} from '@/lib/prisma-client';
import {
  muscleGroupMessageKeys,
  trainingExperienceMessageKeys,
  trainingGoalMessageKeys,
} from '@/i18n/enum-keys';
import { GYM_EQUIPMENT, TRAINING_TIMES, type GymEquipmentTag } from '@/lib/schemas/onboarding';
import { matchesExerciseQuery } from '@/lib/catalog/search-index';
import { fromDisplayWeight, toDisplayWeight, unitLabel } from '@/lib/units';
import { cn } from '@/lib/utils';
import { useExerciseName } from '@/components/shared/use-exercise-name';
import { useOnline } from '@/components/auth/use-online';
import { Button } from '@/components/ui/button';
import { FilterChip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Num } from '@/components/ui/num';
import { ProgressBar } from '@/components/ui/progress-bar';
import { OfflineNotice } from '@/components/ui/screen-state';
import { Section } from '@/components/ui/section';
import { Segmented } from '@/components/ui/segmented';

export interface OnboardingInitial {
  goal: TrainingGoal | null;
  experience: TrainingExperience | null;
  daysPerWeek: number | null;
  trainingDays: number[];
  sessionMinutes: number | null;
  preferredTrainingTime: (typeof TRAINING_TIMES)[number] | null;
  gymName: string | null;
  availableEquipment: string[];
  priorityMuscles: MuscleGroup[];
  avoidExerciseIds: string[];
  bodyweightKg: number | null;
  heightCm: number | null;
  birthDate: string | null;
  sex: Sex | null;
  unit: WeightUnit;
}

interface Props {
  initial: OnboardingInitial;
  exercises: { id: string; name: string }[];
}

const STEPS = ['goal', 'availability', 'gym', 'preferences', 'about'] as const;
const GOALS = Object.keys(trainingGoalMessageKeys) as TrainingGoal[];
const EXPERIENCES = Object.keys(trainingExperienceMessageKeys) as TrainingExperience[];
const DAYS_PER_WEEK = [2, 3, 4, 5, 6] as const;
const SESSION_MINUTES = [30, 45, 60, 75, 90] as const;
// 0 = Sunday, matching Date.getDay().
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const PRIORITY_MUSCLES = (Object.keys(muscleGroupMessageKeys) as MuscleGroup[]).filter(
  (group) => group !== 'OTHER',
);
const MAX_PRIORITY = 3;
// A typical commercial gym, preselected so most people only untick a few.
const DEFAULT_EQUIPMENT: GymEquipmentTag[] = [
  'barbell',
  'dumbbell',
  'bench',
  'incline_bench',
  'rack',
  'smith_machine',
  'cable',
  'machine',
  'leg_press',
  'leg_extension',
  'leg_curl',
  'pec_deck',
  'pull_up_bar',
  'ez_bar',
  'cardio_machine',
];

// Choice chips here are 44px (the FilterChip is 40) so every answer clears
// the touch minimum; a grid cell stretches the chip and centers its label.
const CHOICE = 'h-11';
const CELL = 'h-11 w-full justify-center px-1';
const LEGEND = 'mb-3 text-caption font-semibold';

// A two-line answer (experience level): the option and what it means. Same
// states as the filter chip: input hairline, ink when chosen.
function OptionButton({
  selected,
  onClick,
  children,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  hint: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'flex min-h-touch w-full flex-col gap-0.5 rounded-sm border px-3.5 py-3 text-left transition-colors duration-[120ms] ease-out-quart focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        selected
          ? 'border-ink bg-ink text-ink-foreground'
          : 'border-input bg-transparent text-foreground hover:bg-muted',
      )}
    >
      <span className="text-body font-semibold">{children}</span>
      <span
        className={cn('text-caption', selected ? 'text-ink-foreground' : 'text-muted-foreground')}
      >
        {hint}
      </span>
    </button>
  );
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function OnboardingFlow({ initial, exercises }: Props) {
  const t = useTranslations('onboarding');
  const profileT = useTranslations('settings.profile');
  const exerciseT = useTranslations('exercises');
  const exerciseName = useExerciseName();
  const router = useRouter();
  const online = useOnline();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [goal, setGoal] = useState<TrainingGoal | null>(initial.goal);
  const [experience, setExperience] = useState<TrainingExperience | null>(initial.experience);
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(initial.daysPerWeek);
  const [trainingDays, setTrainingDays] = useState<number[]>(initial.trainingDays);
  const [sessionMinutes, setSessionMinutes] = useState<number | null>(initial.sessionMinutes);
  const [trainingTime, setTrainingTime] = useState(initial.preferredTrainingTime);
  const [gymName, setGymName] = useState(initial.gymName ?? '');
  const [equipment, setEquipment] = useState<string[]>(
    initial.availableEquipment.length > 0 ? initial.availableEquipment : DEFAULT_EQUIPMENT,
  );
  const [priorityMuscles, setPriorityMuscles] = useState<MuscleGroup[]>(initial.priorityMuscles);
  const [avoidIds, setAvoidIds] = useState<string[]>(initial.avoidExerciseIds);
  const [search, setSearch] = useState('');
  const [unit, setUnit] = useState<WeightUnit>(initial.unit);
  const [bodyweight, setBodyweight] = useState(
    initial.bodyweightKg != null ? String(toDisplayWeight(initial.bodyweightKg, initial.unit)) : '',
  );
  const [heightCm, setHeightCm] = useState(
    initial.heightCm != null ? String(initial.heightCm) : '',
  );
  const [birthDate, setBirthDate] = useState(initial.birthDate ?? '');
  const [sex, setSex] = useState<Sex | null>(initial.sex);

  const nameById = useMemo(
    () => new Map(exercises.map((e) => [e.id, exerciseName(e.name)])),
    [exercises, exerciseName],
  );
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    return exercises
      .filter((e) => !avoidIds.includes(e.id))
      .filter((e) => matchesExerciseQuery(e.name, exerciseName(e.name), search))
      .slice(0, 8);
  }, [avoidIds, exerciseName, exercises, search]);

  const isLast = step === STEPS.length - 1;
  const canContinue = step !== 0 || goal !== null;

  async function skip() {
    await fetch('/api/onboarding', { method: 'DELETE' }).catch(() => undefined);
    router.replace('/');
    router.refresh();
  }

  async function save() {
    if (!goal) return;
    setSaving(true);
    try {
      const weight = bodyweight.trim() === '' ? null : Number(bodyweight.replace(',', '.'));
      const height = heightCm.trim() === '' ? null : Number(heightCm);
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal,
          experience,
          daysPerWeek,
          trainingDays,
          sessionMinutes,
          preferredTrainingTime: trainingTime,
          gym: {
            name: gymName.trim() || t('gym.namePlaceholder'),
            availableEquipment: equipment,
          },
          priorityMuscles,
          avoidExerciseIds: avoidIds,
          bodyweight:
            weight != null && Number.isFinite(weight) ? fromDisplayWeight(weight, unit) : null,
          heightCm: height != null && Number.isFinite(height) ? Math.round(height) : null,
          birthDate: birthDate || null,
          sex,
          unit,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success(t('saved'));
      router.replace('/');
      router.refresh();
    } catch {
      toast.error(t('error'));
    } finally {
      setSaving(false);
    }
  }

  const stepKey = STEPS[step]!;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-caption font-semibold text-muted-foreground">
            {t('stepOf', { current: step + 1, total: STEPS.length })}
          </p>
          <Button type="button" variant="ghost" size="sm" className="-mr-3.5 h-11" onClick={skip}>
            {t('skip')}
          </Button>
        </div>
        <ProgressBar value={step + 1} max={STEPS.length} />
      </div>

      {stepKey === 'goal' && (
        <>
          <Section title={t('goal.title')}>
            <p className="-mt-1 text-caption text-muted-foreground">{t('goal.description')}</p>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((option) => (
                <FilterChip
                  key={option}
                  selected={goal === option}
                  onClick={() => setGoal(option)}
                  className={CHOICE}
                >
                  {profileT(trainingGoalMessageKeys[option])}
                </FilterChip>
              ))}
            </div>
          </Section>
          <Section title={t('experience.title')} divider>
            <div className="flex flex-col gap-2">
              {EXPERIENCES.map((option) => {
                const key = trainingExperienceMessageKeys[option];
                return (
                  <OptionButton
                    key={option}
                    selected={experience === option}
                    onClick={() => setExperience(experience === option ? null : option)}
                    hint={t(`experience.${key}Hint`)}
                  >
                    {t(`experience.${key}`)}
                  </OptionButton>
                );
              })}
            </div>
          </Section>
        </>
      )}

      {stepKey === 'availability' && (
        <Section title={t('availability.title')}>
          <div className="flex flex-col gap-6">
            <fieldset>
              <legend className={LEGEND}>{t('availability.daysPerWeek')}</legend>
              <div className="grid grid-cols-5 gap-2">
                {DAYS_PER_WEEK.map((days) => (
                  <FilterChip
                    key={days}
                    selected={daysPerWeek === days}
                    onClick={() => setDaysPerWeek(days)}
                    className={cn(CELL, 'text-body')}
                  >
                    <Num stretch={112}>{days}</Num>
                  </FilterChip>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className={LEGEND}>{t('availability.weekdays')}</legend>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAYS.map((day, index) => (
                  <FilterChip
                    key={day}
                    selected={trainingDays.includes(index)}
                    onClick={() => setTrainingDays(toggle(trainingDays, index))}
                    className={CELL}
                  >
                    {t(`weekdays.${day}`)}
                  </FilterChip>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className={LEGEND}>{t('availability.minutes')}</legend>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {SESSION_MINUTES.map((minutes) => (
                  <FilterChip
                    key={minutes}
                    selected={sessionMinutes === minutes}
                    onClick={() => setSessionMinutes(minutes)}
                    className={CELL}
                  >
                    {t('availability.minutesValue', { minutes })}
                  </FilterChip>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className={LEGEND}>{t('availability.time')}</legend>
              <div className="grid grid-cols-3 gap-2">
                {TRAINING_TIMES.map((time) => (
                  <FilterChip
                    key={time}
                    selected={trainingTime === time}
                    onClick={() => setTrainingTime(trainingTime === time ? null : time)}
                    className={CELL}
                  >
                    {t(`availability.${time}`)}
                  </FilterChip>
                ))}
              </div>
            </fieldset>
          </div>
        </Section>
      )}

      {stepKey === 'gym' && (
        <Section title={t('gym.title')}>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="gym-name" className="text-caption font-semibold leading-tight">
                {t('gym.name')}
              </Label>
              <Input
                id="gym-name"
                value={gymName}
                maxLength={60}
                placeholder={t('gym.namePlaceholder')}
                onChange={(e) => setGymName(e.target.value)}
              />
            </div>
            <fieldset aria-describedby="gym-equipment-hint">
              <legend className="text-caption font-semibold">{t('gym.equipment')}</legend>
              <p id="gym-equipment-hint" className="mb-3 mt-1 text-caption text-muted-foreground">
                {t('gym.equipmentHint')}
              </p>
              <div className="flex flex-wrap gap-2">
                {GYM_EQUIPMENT.map((item) => (
                  <FilterChip
                    key={item}
                    selected={equipment.includes(item)}
                    onClick={() => setEquipment(toggle(equipment, item))}
                    className={CHOICE}
                  >
                    {t(`equipment.${item}`)}
                  </FilterChip>
                ))}
              </div>
            </fieldset>
          </div>
        </Section>
      )}

      {stepKey === 'preferences' && (
        <Section title={t('preferences.title')}>
          <div className="flex flex-col gap-6">
            <fieldset>
              <legend className={LEGEND}>{t('preferences.priority')}</legend>
              <div className="flex flex-wrap gap-2">
                {PRIORITY_MUSCLES.map((group) => {
                  const selected = priorityMuscles.includes(group);
                  return (
                    <FilterChip
                      key={group}
                      selected={selected}
                      className={CHOICE}
                      onClick={() => {
                        if (selected)
                          setPriorityMuscles(priorityMuscles.filter((g) => g !== group));
                        else if (priorityMuscles.length < MAX_PRIORITY)
                          setPriorityMuscles([...priorityMuscles, group]);
                      }}
                    >
                      {exerciseT(`muscleGroups.${muscleGroupMessageKeys[group]}`)}
                    </FilterChip>
                  );
                })}
              </div>
            </fieldset>
            <div className="flex flex-col gap-2 border-t border-border pt-5">
              <Label htmlFor="avoid-search" className="text-caption font-semibold leading-tight">
                {t('preferences.avoid')}
              </Label>
              <p id="avoid-hint" className="text-caption text-muted-foreground">
                {t('preferences.avoidHint')}
              </p>
              {avoidIds.length > 0 && (
                <ul className="flex flex-wrap gap-2 py-1" aria-label={t('preferences.avoid')}>
                  {avoidIds.map((id) => {
                    const name = nameById.get(id) ?? id;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => setAvoidIds(avoidIds.filter((v) => v !== id))}
                          aria-label={t('preferences.remove', { name })}
                          className="inline-flex h-11 items-center gap-1.5 rounded-sm bg-ink px-3.5 text-caption font-semibold text-ink-foreground transition-[filter] duration-[120ms] ease-out-quart hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          {name}
                          <XIcon weight="bold" className="size-4" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Input
                id="avoid-search"
                type="search"
                value={search}
                placeholder={t('preferences.search')}
                aria-describedby="avoid-hint"
                onChange={(e) => setSearch(e.target.value)}
              />
              {search.trim() &&
                (searchResults.length === 0 ? (
                  <p className="py-2 text-caption text-muted-foreground">
                    {t('preferences.noResults')}
                  </p>
                ) : (
                  <ul className="flex flex-col">
                    {searchResults.map((exercise) => (
                      <li key={exercise.id} className="border-b border-border">
                        <button
                          type="button"
                          onClick={() => {
                            setAvoidIds([...avoidIds, exercise.id]);
                            setSearch('');
                          }}
                          className="flex min-h-touch w-full items-center justify-between gap-3 rounded-xs py-2.5 text-left text-body font-semibold transition-colors duration-[120ms] ease-out-quart hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {exerciseName(exercise.name)}
                          <PlusIcon className="size-4 shrink-0 text-muted-foreground" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ))}
              <p className="text-caption text-muted-foreground">
                {t('preferences.selected', { count: avoidIds.length })}
              </p>
            </div>
          </div>
        </Section>
      )}

      {stepKey === 'about' && (
        <Section title={t('about.title')}>
          <p className="-mt-1 text-caption text-muted-foreground">{t('about.description')}</p>
          <div className="flex flex-col gap-6 pt-2">
            <div className="flex flex-col gap-2">
              <p className="text-caption font-semibold" aria-hidden="true">
                {t('about.unit')}
              </p>
              <Segmented
                label={t('about.unit')}
                value={unit}
                onChange={setUnit}
                options={[
                  { value: 'KG', label: profileT('kilograms') },
                  { value: 'LB', label: profileT('pounds') },
                ]}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="onboarding-weight"
                  className="text-caption font-semibold leading-tight"
                >
                  {t('about.bodyweight', { unit: unitLabel(unit) })}
                </Label>
                <Input
                  id="onboarding-weight"
                  inputMode="decimal"
                  value={bodyweight}
                  onChange={(e) => setBodyweight(e.target.value)}
                  className="font-num tabular-nums stretch-112"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="onboarding-height"
                  className="text-caption font-semibold leading-tight"
                >
                  {t('about.height')}
                </Label>
                <Input
                  id="onboarding-height"
                  inputMode="numeric"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="font-num tabular-nums stretch-112"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="onboarding-birth" className="text-caption font-semibold leading-tight">
                {t('about.birthDate')}
              </Label>
              <Input
                id="onboarding-birth"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="max-w-xs"
              />
            </div>
            <fieldset>
              <legend className={LEGEND}>{t('about.sex')}</legend>
              <div className="grid grid-cols-3 gap-2">
                {(['FEMALE', 'MALE', 'OTHER'] as const).map((option) => (
                  <FilterChip
                    key={option}
                    selected={sex === option}
                    onClick={() => setSex(sex === option ? null : option)}
                    className={CELL}
                  >
                    {profileT(
                      option === 'FEMALE' ? 'female' : option === 'MALE' ? 'male' : 'other',
                    )}
                  </FilterChip>
                ))}
              </div>
            </fieldset>
          </div>
        </Section>
      )}

      {/* Docked to the bottom edge: back and continue stay under the thumb. */}
      <div className="sticky bottom-0 -mx-5 flex flex-col gap-3 border-t border-border bg-background px-5 py-3">
        {!online && <OfflineNotice>{t('offline')}</OfflineNotice>}
        <div className="flex gap-3">
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(step - 1)}
              disabled={saving}
            >
              <CaretLeftIcon className="size-4" aria-hidden="true" />
              {t('back')}
            </Button>
          )}
          <Button
            type="button"
            className="flex-1"
            disabled={!canContinue}
            loading={saving}
            onClick={() => (isLast ? save() : setStep(step + 1))}
          >
            {isLast ? t('finish') : t('next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
