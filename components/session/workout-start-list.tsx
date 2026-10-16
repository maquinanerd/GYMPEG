'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tag } from '@/components/ui/tag';
import { StartWorkoutButton } from '@/components/session/start-workout-button';

interface WorkoutOption {
  id: string;
  name: string;
  day: string | null;
  exerciseCount: number;
}

// The program's workouts as rows on the page (no cards): name, how many
// exercises and the scheduled day, then the start button. The suggested one
// (the program's next workout) gets the "Sugerido" tag and the ink button;
// the others an outline one.
export function WorkoutStartList({
  workouts,
  gyms,
  activeGymId,
  suggestedId = null,
}: {
  workouts: WorkoutOption[];
  gyms: Array<{ id: string; name: string }>;
  activeGymId: string | null;
  // The next workout of the program's schedule (lib/next-workout), if any.
  suggestedId?: string | null;
}) {
  const t = useTranslations('session');
  const common = useTranslations('common');
  const [gymId, setGymId] = useState(activeGymId ?? gyms[0]?.id ?? 'none');

  return (
    <>
      {gyms.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="training-gym">{t('trainingGym')}</Label>
          <Select value={gymId} onValueChange={setGymId}>
            <SelectTrigger id="training-gym" aria-describedby="training-gym-description">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {gyms.map((gym) => (
                <SelectItem key={gym.id} value={gym.id}>
                  {gym.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p id="training-gym-description" className="text-[0.8125rem] font-medium text-muted-foreground">
            {t('trainingGymDescription')}
          </p>
        </div>
      )}

      <ul className="flex flex-col">
        {workouts.map((workout) => {
          const suggested = workout.id === suggestedId;
          const nameId = `start-workout-${workout.id}`;
          return (
            <li
              key={workout.id}
              data-suggested={suggested || undefined}
              className="flex flex-col gap-3 border-t border-border py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <h2 id={nameId} className="text-subtitle [overflow-wrap:anywhere]">
                    {workout.name}
                  </h2>
                  <p className="text-[0.8125rem] font-medium text-muted-foreground">
                    {[common('counts.exercises', { count: workout.exerciseCount }), workout.day]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {suggested && <Tag variant="primary">{t('suggested')}</Tag>}
              </div>
              <StartWorkoutButton
                workoutId={workout.id}
                gymId={gymId === 'none' ? null : gymId}
                disabled={workout.exerciseCount === 0}
                variant={suggested ? 'ink' : 'outline'}
                className={suggested ? undefined : 'h-11 text-body'}
                describedBy={nameId}
              />
            </li>
          );
        })}
      </ul>
    </>
  );
}
