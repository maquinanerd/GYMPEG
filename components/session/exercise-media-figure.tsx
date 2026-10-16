'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { EquipmentType, MuscleGroup } from '@/lib/prisma-client';
import { ArrowsOutIcon, PauseIcon, PlayIcon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/button';
import { MuscleMap } from '@/components/progress/muscle-map';
import { ExerciseMediaDialog, useFrameCycle } from '@/components/exercises/exercise-media-dialog';
import { getExerciseMedia } from '@/lib/exercise-media';
import { compactMuscles } from '@/lib/muscle-map';
import { cn } from '@/lib/utils';

// The picture at the top of the running exercise: full width, 3:2, radius 12.
// The start and end frames alternate every 1.5 s (paused from the start with
// reduced motion) under a lime "Start"/"End" label; two 44px white buttons
// pause and enlarge, and a tap on the picture enlarges too. Without media the
// same box holds the muscle map of the exercise on the muted fill.
export function ExerciseMediaFigure({
  exerciseName,
  displayName,
  equipmentType,
  muscleGroup,
}: {
  exerciseName: string;
  displayName: string;
  equipmentType: EquipmentType;
  muscleGroup: MuscleGroup;
}) {
  const t = useTranslations('exercises.media');
  const viewerT = useTranslations('session.media');
  const media = getExerciseMedia(exerciseName);
  const [viewerOpen, setViewerOpen] = useState(false);
  // The small picture pauses while the viewer runs its own cycle.
  const cycle = useFrameCycle(media != null && !viewerOpen);

  if (!media) {
    return (
      <figure
        data-testid="exercise-media-fallback"
        className="flex aspect-[3/2] shrink-0 items-center justify-center rounded-md bg-muted"
      >
        <MuscleMap active={compactMuscles([muscleGroup])} size={168} />
      </figure>
    );
  }

  return (
    <figure className="relative aspect-[3/2] shrink-0 overflow-hidden rounded-md bg-muted">
      {media.frames.map((source, index) => (
        <Image
          key={source}
          src={source}
          alt={t(index === 0 ? 'startAlt' : 'finishAlt', { name: displayName })}
          aria-hidden={cycle.frame === index ? undefined : true}
          fill
          unoptimized
          priority={index === 0}
          sizes="(max-width: 672px) 100vw, 632px"
          className={cn('object-cover', cycle.frame === index ? 'opacity-100' : 'opacity-0')}
        />
      ))}
      {/* The whole picture is a tap target for touch; keyboard and screen
          reader users get the labelled enlarge button below instead. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={() => setViewerOpen(true)}
        className="absolute inset-0 cursor-zoom-in"
      />
      <span className="pointer-events-none absolute left-2.5 top-2.5 flex h-6 items-center rounded-xs bg-primary px-2 text-small font-semibold text-primary-foreground">
        {t(cycle.frame === 0 ? 'start' : 'finish')}
      </span>
      <div className="absolute bottom-2 right-2 flex gap-1.5">
        <IconButton
          size="sm"
          tone="card"
          onClick={cycle.togglePlaying}
          aria-label={t(cycle.playing ? 'pause' : 'play')}
          title={t(cycle.playing ? 'pause' : 'play')}
        >
          {cycle.playing ? <PauseIcon /> : <PlayIcon />}
        </IconButton>
        <IconButton
          size="sm"
          tone="card"
          onClick={() => setViewerOpen(true)}
          aria-label={viewerT('enlarge')}
          title={viewerT('enlarge')}
        >
          <ArrowsOutIcon />
        </IconButton>
      </div>
      <ExerciseMediaDialog
        exerciseName={exerciseName}
        displayName={displayName}
        equipmentType={equipmentType}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        initialFrame={cycle.frame}
      />
    </figure>
  );
}
