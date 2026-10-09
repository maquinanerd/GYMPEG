import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import type { PersonalRecordType, WeightUnit } from '@/lib/prisma-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getExerciseDisplayName } from '@/i18n/exercise-names';
import { formatWeight } from '@/lib/units';

export interface RecentRecord {
  id: string;
  type: PersonalRecordType;
  exerciseName: string | null;
  value: number;
  previousValue: number;
  weightKg: number | null;
  reps: number | null;
}

const MESSAGE_KEYS = {
  WEIGHT: 'weight',
  REPS: 'reps',
  E1RM: 'e1rm',
  SET_VOLUME: 'setVolume',
  EXERCISE_VOLUME: 'exerciseVolume',
  WORKOUT_TONNAGE: 'workoutTonnage',
  WEEKLY_TONNAGE: 'weeklyTonnage',
} as const satisfies Record<PersonalRecordType, string>;

// Records the last sessions beat (epic 2.2), each with what it beat, e.g.
// "Supino: 1RM estimado 94 kg (antes 91 kg)". Hidden when there is none.
export async function RecentRecordsCard({
  records,
  unit,
}: {
  records: RecentRecord[];
  unit: WeightUnit;
}) {
  if (records.length === 0) return null;
  const t = await getTranslations('dashboard.records');
  const locale = await getLocale();
  const kg = (value: number) => formatWeight(value, unit, { decimals: 1, locale });

  return (
    <Card data-testid="recent-records">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="size-4 text-primary" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <ul className="flex flex-col gap-1.5 text-sm">
          {records.map((record) => {
            const exercise = record.exerciseName
              ? getExerciseDisplayName(record.exerciseName, locale)
              : '';
            const reps = record.type === 'REPS';
            return (
              <li key={record.id}>
                {t(MESSAGE_KEYS[record.type], {
                  exercise,
                  value: reps ? String(record.value) : kg(record.value),
                  previous: reps ? String(record.previousValue) : kg(record.previousValue),
                  weight: kg(record.weightKg ?? 0),
                })}
              </li>
            );
          })}
        </ul>
        <Link
          href="/progress"
          className="self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t('viewAll')}
        </Link>
      </CardContent>
    </Card>
  );
}
