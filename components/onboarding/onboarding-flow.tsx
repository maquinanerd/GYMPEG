'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronLeft, Loader2, X } from 'lucide-react';
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
import { useExerciseName } from '@/components/shared/use-exercise-name';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

// A large toggle button: easy to hit with one thumb at the gym.
function Choice({
  selected,
  onClick,
  children,
  hint,
  className = '',
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-12 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        selected
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input bg-background hover:bg-muted'
      } ${className}`}
    >
      <span className="block font-medium">{children}</span>
      {hint && (
        <span
          className={`block text-xs ${selected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}
        >
          {hint}
        </span>
      )}
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t('stepOf', { current: step + 1, total: STEPS.length })}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={skip}>
          {t('skip')}
        </Button>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      {stepKey === 'goal' && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('goal.title')}</CardTitle>
              <CardDescription>{t('goal.description')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {GOALS.map((option) => (
                <Choice key={option} selected={goal === option} onClick={() => setGoal(option)}>
                  {profileT(trainingGoalMessageKeys[option])}
                </Choice>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('experience.title')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {EXPERIENCES.map((option) => {
                const key = trainingExperienceMessageKeys[option];
                return (
                  <Choice
                    key={option}
                    selected={experience === option}
                    onClick={() => setExperience(experience === option ? null : option)}
                    hint={t(`experience.${key}Hint`)}
                  >
                    {t(`experience.${key}`)}
                  </Choice>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}

      {stepKey === 'availability' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('availability.title')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t('availability.daysPerWeek')}</legend>
              <div className="grid grid-cols-5 gap-2">
                {DAYS_PER_WEEK.map((days) => (
                  <Choice
                    key={days}
                    selected={daysPerWeek === days}
                    onClick={() => setDaysPerWeek(days)}
                    className="text-center"
                  >
                    {days}
                  </Choice>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t('availability.weekdays')}</legend>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAYS.map((day, index) => (
                  <Choice
                    key={day}
                    selected={trainingDays.includes(index)}
                    onClick={() => setTrainingDays(toggle(trainingDays, index))}
                    className="px-1 text-center"
                  >
                    {t(`weekdays.${day}`)}
                  </Choice>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t('availability.minutes')}</legend>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {SESSION_MINUTES.map((minutes) => (
                  <Choice
                    key={minutes}
                    selected={sessionMinutes === minutes}
                    onClick={() => setSessionMinutes(minutes)}
                    className="text-center"
                  >
                    {t('availability.minutesValue', { minutes })}
                  </Choice>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t('availability.time')}</legend>
              <div className="grid grid-cols-3 gap-2">
                {TRAINING_TIMES.map((time) => (
                  <Choice
                    key={time}
                    selected={trainingTime === time}
                    onClick={() => setTrainingTime(trainingTime === time ? null : time)}
                    className="text-center"
                  >
                    {t(`availability.${time}`)}
                  </Choice>
                ))}
              </div>
            </fieldset>
          </CardContent>
        </Card>
      )}

      {stepKey === 'gym' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('gym.title')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="space-y-1.5">
              <Label htmlFor="gym-name">{t('gym.name')}</Label>
              <Input
                id="gym-name"
                value={gymName}
                maxLength={60}
                placeholder={t('gym.namePlaceholder')}
                onChange={(e) => setGymName(e.target.value)}
              />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t('gym.equipment')}</legend>
              <p className="text-xs text-muted-foreground">{t('gym.equipmentHint')}</p>
              <div className="grid grid-cols-2 gap-2">
                {GYM_EQUIPMENT.map((item) => (
                  <Choice
                    key={item}
                    selected={equipment.includes(item)}
                    onClick={() => setEquipment(toggle(equipment, item))}
                  >
                    {t(`equipment.${item}`)}
                  </Choice>
                ))}
              </div>
            </fieldset>
          </CardContent>
        </Card>
      )}

      {stepKey === 'preferences' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('preferences.title')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t('preferences.priority')}</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PRIORITY_MUSCLES.map((group) => {
                  const selected = priorityMuscles.includes(group);
                  return (
                    <Choice
                      key={group}
                      selected={selected}
                      onClick={() => {
                        if (selected)
                          setPriorityMuscles(priorityMuscles.filter((g) => g !== group));
                        else if (priorityMuscles.length < MAX_PRIORITY)
                          setPriorityMuscles([...priorityMuscles, group]);
                      }}
                    >
                      {exerciseT(`muscleGroups.${muscleGroupMessageKeys[group]}`)}
                    </Choice>
                  );
                })}
              </div>
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="avoid-search">{t('preferences.avoid')}</Label>
              <p className="text-xs text-muted-foreground">{t('preferences.avoidHint')}</p>
              {avoidIds.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label={t('preferences.avoid')}>
                  {avoidIds.map((id) => {
                    const name = nameById.get(id) ?? id;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => setAvoidIds(avoidIds.filter((v) => v !== id))}
                          aria-label={t('preferences.remove', { name })}
                          className="inline-flex min-h-10 items-center gap-1 rounded-full border border-input bg-muted px-3 text-sm"
                        >
                          {name}
                          <X className="size-3.5" aria-hidden="true" />
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
                onChange={(e) => setSearch(e.target.value)}
              />
              {search.trim() && (
                <div className="flex flex-col gap-1.5">
                  {searchResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('preferences.noResults')}</p>
                  ) : (
                    searchResults.map((exercise) => (
                      <Choice
                        key={exercise.id}
                        selected={false}
                        onClick={() => {
                          setAvoidIds([...avoidIds, exercise.id]);
                          setSearch('');
                        }}
                      >
                        {exerciseName(exercise.name)}
                      </Choice>
                    ))
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {t('preferences.selected', { count: avoidIds.length })}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {stepKey === 'about' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('about.title')}</CardTitle>
            <CardDescription>{t('about.description')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t('about.unit')}</legend>
              <div className="grid grid-cols-2 gap-2">
                {(['KG', 'LB'] as const).map((option) => (
                  <Choice
                    key={option}
                    selected={unit === option}
                    onClick={() => setUnit(option)}
                    className="text-center"
                  >
                    {option === 'KG' ? profileT('kilograms') : profileT('pounds')}
                  </Choice>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="onboarding-weight">
                  {t('about.bodyweight', { unit: unitLabel(unit) })}
                </Label>
                <Input
                  id="onboarding-weight"
                  inputMode="decimal"
                  value={bodyweight}
                  onChange={(e) => setBodyweight(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="onboarding-height">{t('about.height')}</Label>
                <Input
                  id="onboarding-height"
                  inputMode="numeric"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="onboarding-birth">{t('about.birthDate')}</Label>
              <Input
                id="onboarding-birth"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="max-w-xs"
              />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t('about.sex')}</legend>
              <div className="grid grid-cols-3 gap-2">
                {(['FEMALE', 'MALE', 'OTHER'] as const).map((option) => (
                  <Choice
                    key={option}
                    selected={sex === option}
                    onClick={() => setSex(sex === option ? null : option)}
                    className="text-center"
                  >
                    {profileT(
                      option === 'FEMALE' ? 'female' : option === 'MALE' ? 'male' : 'other',
                    )}
                  </Choice>
                ))}
              </div>
            </fieldset>
          </CardContent>
        </Card>
      )}

      <div className="sticky bottom-0 flex gap-3 bg-background/95 py-3">
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            className="min-h-12"
            onClick={() => setStep(step - 1)}
            disabled={saving}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span className="ml-1">{t('back')}</span>
          </Button>
        )}
        <Button
          type="button"
          className="min-h-12 flex-1"
          disabled={!canContinue || saving}
          onClick={() => (isLast ? save() : setStep(step + 1))}
        >
          {saving && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
          {saving ? t('saving') : isLast ? t('finish') : t('next')}
        </Button>
      </div>
    </div>
  );
}
