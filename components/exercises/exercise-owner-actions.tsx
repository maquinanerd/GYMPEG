'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PencilSimpleIcon } from '@/components/ui/icon';
import type { Exercise } from '@/lib/prisma-client';
import { Button } from '@/components/ui/button';
import { ExerciseFormDialog } from '@/components/exercises/exercise-form-dialog';
import { DeleteExerciseButton } from '@/components/exercises/delete-exercise-button';

// Edit and delete of a custom exercise, on its own page. Catalog exercises are
// shared and read-only, so the page renders this only for the lifter's own.
export function ExerciseOwnerActions({
  exercise,
  displayName,
}: {
  exercise: Exercise;
  displayName: string;
}) {
  const t = useTranslations('exercises');
  const common = useTranslations('common');
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => setEditing(true)} aria-label={t('editTitle')}>
        <PencilSimpleIcon />
        {common('actions.edit')}
      </Button>
      <DeleteExerciseButton
        exerciseId={exercise.id}
        exerciseName={displayName}
        redirectTo="/exercises"
      />
      <ExerciseFormDialog open={editing} onOpenChange={setEditing} mode="edit" exercise={exercise} />
    </div>
  );
}
