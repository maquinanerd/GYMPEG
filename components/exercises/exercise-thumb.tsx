import Image from 'next/image';
import type { MuscleGroup } from '@/lib/prisma-client';
import { getExerciseMedia } from '@/lib/exercise-media';
import { compactMuscles } from '@/lib/muscle-map';
import { MuscleMap } from '@/components/progress/muscle-map';
import { cn } from '@/lib/utils';

const SIZE = {
  // Catalog rows: 52px.
  sm: { box: 'size-[52px]', map: 38 },
  // Workout rows: 64px, 48px on the narrowest phones so the name keeps room.
  md: { box: 'size-12 min-[375px]:size-16', map: 40 },
} as const;

// Leading picture of an exercise row, radius 8: the start frame of its
// technique media (object-fit cover) when a licensed source maps it, else a
// muted square with the small muscle figure of its group. Decorative: the row
// names the exercise.
export function ExerciseThumb({
  name,
  muscleGroup,
  size = 'sm',
  className,
}: {
  // Catalog name (the media lookup key), not the display name.
  name: string;
  muscleGroup: MuscleGroup;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const media = getExerciseMedia(name);
  const box = cn('relative block shrink-0 overflow-hidden rounded-sm bg-muted', SIZE[size].box, className);

  if (media) {
    return (
      <span aria-hidden data-testid="exercise-thumb" className={box}>
        <Image
          src={media.frames[0]}
          alt=""
          fill
          unoptimized
          sizes="64px"
          className="object-cover"
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      data-testid="exercise-thumb"
      className={cn(box, 'flex items-center justify-center')}
    >
      <MuscleMap active={compactMuscles([muscleGroup])} size={SIZE[size].map} />
    </span>
  );
}
