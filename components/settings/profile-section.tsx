'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { Sex, TrainingGoal, WeightUnit } from '@/lib/prisma-client';
import { trainingGoalMessageKeys } from '@/i18n/enum-keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { textLinkClass } from '@/components/ui/section';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface ProfileData {
  displayName: string | null;
  bodyweight: number | null;
  sex: Sex | null;
  heightCm: number | null;
  goal: TrainingGoal | null;
  weeklyFrequency: number | null;
  unit: WeightUnit;
  timezone: string;
}

interface Props {
  initial: ProfileData;
}

const SEX_OPTIONS: Sex[] = ['MALE', 'FEMALE', 'OTHER'];
const GOAL_OPTIONS = Object.keys(trainingGoalMessageKeys) as TrainingGoal[];
const UNIT_OPTIONS: WeightUnit[] = ['KG', 'LB'];

function numOrEmpty(n: number | null): string {
  return n != null ? String(n) : '';
}

export function ProfileSection({ initial }: Props) {
  const t = useTranslations('settings.profile');
  const common = useTranslations('common');
  const [displayName, setDisplayName] = useState(initial.displayName ?? '');
  const [bodyweight, setBodyweight] = useState(numOrEmpty(initial.bodyweight));
  const [heightCm, setHeightCm] = useState(numOrEmpty(initial.heightCm));
  const [weeklyFrequency, setWeeklyFrequency] = useState(numOrEmpty(initial.weeklyFrequency));
  const [sex, setSex] = useState<Sex | undefined>(initial.sex ?? undefined);
  const [goal, setGoal] = useState<TrainingGoal | undefined>(initial.goal ?? undefined);
  const [unit, setUnit] = useState<WeightUnit>(initial.unit);
  const [timezone, setTimezone] = useState(initial.timezone);
  // The full zone list is read after mount: server and browser ICU data can
  // differ, and rendering it on the server would risk a hydration mismatch.
  const [zoneOptions, setZoneOptions] = useState<string[]>([initial.timezone]);
  const [deviceZone, setDeviceZone] = useState<string | null>(null);
  useEffect(() => {
    const zones = new Set(Intl.supportedValuesOf('timeZone'));
    zones.add(initial.timezone);
    setZoneOptions([...zones].sort());
    setDeviceZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, [initial.timezone]);
  const [pending, setPending] = useState(false);

  function rangeOk(value: string, min: number, max: number): boolean {
    if (value === '') return true;
    const n = Number(value);
    return Number.isFinite(n) && n >= min && n <= max;
  }

  const isValid =
    rangeOk(bodyweight, 20, 300) && rangeOk(heightCm, 100, 250) && rangeOk(weeklyFrequency, 1, 14);

  async function save() {
    if (!isValid) {
      toast.error(t('fixFields'));
      return;
    }
    setPending(true);
    try {
      const body: Record<string, unknown> = {
        displayName: displayName.trim() === '' ? null : displayName.trim(),
        bodyweight: bodyweight === '' ? null : Number(bodyweight),
        heightCm: heightCm === '' ? null : Number(heightCm),
        weeklyFrequency: weeklyFrequency === '' ? null : Number(weeklyFrequency),
      };
      if (sex) body.sex = sex;
      if (goal) body.goal = goal;
      body.unit = unit;
      body.timezone = timezone;

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      toast.success(t('saved'));
    } catch {
      toast.error(t('saveError'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="displayName" className={LABEL}>
            {t('displayName')}
          </Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t('namePlaceholder')}
            maxLength={80}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bodyweight" className={LABEL}>
              {t('bodyweightLabel')}
            </Label>
            <Input
              id="bodyweight"
              type="number"
              inputMode="decimal"
              step="0.1"
              value={bodyweight}
              onChange={(e) => setBodyweight(e.target.value)}
              placeholder="75"
              className={NUMBER}
            />
            {!rangeOk(bodyweight, 20, 300) && (
              <p className={FIELD_ERROR}>{t('bodyweightRange')}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="heightCm" className={LABEL}>
              {t('heightLabel')}
            </Label>
            <Input
              id="heightCm"
              type="number"
              inputMode="numeric"
              step="1"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="178"
              className={NUMBER}
            />
            {!rangeOk(heightCm, 100, 250) && (
              <p className={FIELD_ERROR}>{t('heightRange')}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className={LABEL}>{t('sex')}</Label>
            <Select value={sex} onValueChange={(v) => setSex(v as Sex)}>
              <SelectTrigger aria-label={t('sex')}>
                <SelectValue placeholder={t('notSet')} />
              </SelectTrigger>
              <SelectContent>
                {SEX_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option === 'MALE' ? t('male') : option === 'FEMALE' ? t('female') : t('other')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="weeklyFrequency" className={LABEL}>
              {t('weeklyFrequencyLabel')}
            </Label>
            <Input
              id="weeklyFrequency"
              type="number"
              inputMode="numeric"
              step="1"
              value={weeklyFrequency}
              onChange={(e) => setWeeklyFrequency(e.target.value)}
              placeholder="3"
              className={NUMBER}
            />
            {!rangeOk(weeklyFrequency, 1, 14) && (
              <p className={FIELD_ERROR}>{t('weeklyFrequencyRange')}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className={LABEL}>{t('goal')}</Label>
          <Select value={goal} onValueChange={(v) => setGoal(v as TrainingGoal)}>
            <SelectTrigger aria-label={t('goal')}>
              <SelectValue placeholder={t('notSet')} />
            </SelectTrigger>
            <SelectContent>
              {GOAL_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(trainingGoalMessageKeys[option])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Perfil > Unidade links here (#unit). */}
        <div id="unit" className="flex scroll-mt-4 flex-col gap-1.5">
          <Label className={LABEL}>{t('unit')}</Label>
          <Select value={unit} onValueChange={(v) => setUnit(v as WeightUnit)}>
            <SelectTrigger aria-label={t('unit')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIT_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === 'KG' ? t('kilograms') : t('pounds')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className={HINT}>{t('unitDescription')}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="timezone" className={LABEL}>
            {t('timezone')}
          </Label>
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="flex h-12 w-full rounded-md border border-input bg-card px-3.5 text-body font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {zoneOptions.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <p className={HINT}>{t('timezoneDescription')}</p>
          {deviceZone && deviceZone !== timezone && (
            <button
              type="button"
              className={cn(textLinkClass, 'min-h-11 self-start text-left')}
              onClick={() => setTimezone(deviceZone)}
            >
              {t('useDeviceTimezone', { zone: deviceZone.replace(/_/g, ' ') })}
            </button>
          )}
        </div>

        <Button
          type="button"
          onClick={save}
          loading={pending}
          disabled={pending || !isValid}
          className="w-full sm:w-auto sm:self-start"
        >
          {common('actions.save')}
        </Button>
    </div>
  );
}

const LABEL = 'text-caption font-semibold';
const HINT = 'text-[0.8125rem] font-medium text-muted-foreground';
const FIELD_ERROR = 'text-[0.8125rem] font-medium text-destructive-text';
const NUMBER = 'font-num tabular-nums stretch-112';
