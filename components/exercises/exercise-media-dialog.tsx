'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  PlayCircleIcon,
  ArrowSquareOutIcon,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
  XIcon,
} from '@/components/ui/icon';
import type { EquipmentType } from '@/lib/prisma-client';
import { getExerciseMedia } from '@/lib/exercise-media';
import { equipmentTypeMessageKeys } from '@/i18n/enum-keys';
import { Button, IconButton } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import { cn } from '@/lib/utils';

// How long each frame (start, end) stays on screen while the pair alternates.
export const FRAME_INTERVAL_MS = 1500;

export type MediaFrame = 0 | 1;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// Start/end frames alternating every 1.5 s while `active`. Paused from the
// start for a lifter who prefers reduced motion; showing one frame pauses.
export function useFrameCycle(active: boolean) {
  const [frame, setFrame] = useState<MediaFrame>(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (prefersReducedMotion()) setPlaying(false);
  }, []);

  useEffect(() => {
    if (!active || !playing) return;
    const timer = window.setInterval(
      () => setFrame((current) => (current === 0 ? 1 : 0)),
      FRAME_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, [active, playing]);

  return {
    frame,
    playing,
    togglePlaying: () => setPlaying((value) => !value),
    show: (next: MediaFrame) => {
      setPlaying(false);
      setFrame(next);
    },
    reset: (next: MediaFrame = 0) => {
      setFrame(next);
      setPlaying(!prefersReducedMotion());
    },
  };
}

interface Props {
  exerciseName: string;
  displayName: string;
  equipmentType: EquipmentType;
  compact?: boolean;
  // A full-width row of an action sheet (the workout's exercise menu).
  asMenuItem?: boolean;
  // Controlled viewer with no trigger of its own: the running workout opens
  // it from the exercise picture.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Frame shown first when the viewer opens.
  initialFrame?: MediaFrame;
}

// The technique viewer: fills the screen with the start and end frames of
// the movement (object-fit contain), 64px controls (start, pause, end), both
// frames as thumbnails, the equipment and the source credit with its license.
export function ExerciseMediaDialog({
  exerciseName,
  displayName,
  equipmentType,
  compact = false,
  asMenuItem = false,
  open: controlledOpen,
  onOpenChange,
  initialFrame = 0,
}: Props) {
  const t = useTranslations('exercises.media');
  const viewerT = useTranslations('session.media');
  const exerciseT = useTranslations('exercises');
  const media = getExerciseMedia(exerciseName);
  const controlled = controlledOpen !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlled ? controlledOpen : uncontrolledOpen;
  const cycle = useFrameCycle(open && media != null);
  const { reset } = cycle;

  // Every opening starts on the requested frame, playing unless the lifter
  // prefers reduced motion.
  useEffect(() => {
    if (open) reset(initialFrame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function changeOpen(value: boolean) {
    if (!controlled) setUncontrolledOpen(value);
    onOpenChange?.(value);
  }

  const equipmentLabel = exerciseT(`equipmentTypes.${equipmentTypeMessageKeys[equipmentType]}`);
  const commonsUrl = `https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(
    `${exerciseName} ${equipmentLabel}`,
  )}&title=Special:MediaSearch&type=image`;
  const frameLabel = (index: MediaFrame) => t(index === 0 ? 'start' : 'finish');

  return (
    <DialogPrimitive.Root open={open} onOpenChange={changeOpen}>
      {!controlled && (
        <DialogPrimitive.Trigger asChild>
          {compact ? (
            // A fixed 64px slot whether or not media exists, so catalog cards
            // share one leading column and one row height (issue #330). With
            // media the start frame is the thumbnail; without it the slot holds
            // a muted play icon at the same size.
            <button
              type="button"
              className="relative flex size-16 min-h-tap min-w-tap shrink-0 items-center justify-center overflow-hidden rounded-sm border border-input bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={t('open', { name: displayName })}
              title={t('button')}
            >
              {media ? (
                <Image
                  src={media.frames[0]}
                  alt=""
                  fill
                  unoptimized
                  sizes="64px"
                  className="object-cover"
                />
              ) : (
                <PlayCircleIcon className="size-5 text-muted-foreground" />
              )}
            </button>
          ) : asMenuItem ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-tap w-full justify-start"
              aria-label={t('open', { name: displayName })}
            >
              <PlayCircleIcon />
              <span>{t('button')}</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              aria-label={t('open', { name: displayName })}
            >
              <PlayCircleIcon />
              <span>{t('button')}</span>
            </Button>
          )}
        </DialogPrimitive.Trigger>
      )}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-card pt-[env(safe-area-inset-top)] text-card-foreground scrollbar-none focus:outline-none">
          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
            <header className="flex items-center gap-2 py-1 pl-5 pr-2">
              <div className="flex min-w-0 flex-1 flex-col">
                <DialogPrimitive.Title className="text-heading">{displayName}</DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-[0.8125rem] font-medium text-muted-foreground">
                  {media ? viewerT('subtitle') : t('description')}
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close asChild>
                <IconButton aria-label={viewerT('close')} title={viewerT('close')}>
                  <XIcon weight="bold" />
                </IconButton>
              </DialogPrimitive.Close>
            </header>

            {media ? (
              <div className="flex flex-col gap-[18px] pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3">
                <figure className="relative aspect-[3/2] bg-muted sm:mx-5 sm:overflow-hidden sm:rounded-md">
                  {media.frames.map((source, index) => (
                    <Image
                      key={source}
                      src={source}
                      alt={t(index === 0 ? 'startAlt' : 'finishAlt', { name: displayName })}
                      aria-hidden={cycle.frame === index ? undefined : true}
                      fill
                      unoptimized
                      sizes="(max-width: 672px) 100vw, 632px"
                      className={cn(
                        'object-contain',
                        cycle.frame === index ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  ))}
                  <span className="absolute left-3 top-3 flex h-[26px] items-center rounded-xs bg-primary px-[9px] text-[0.8125rem] font-semibold text-primary-foreground">
                    {frameLabel(cycle.frame)}
                  </span>
                  {media.approximate && (
                    <Tag variant="muted" className="absolute right-3 top-3 bg-card">
                      {t('similarVariant')}
                    </Tag>
                  )}
                </figure>

                <div className="flex justify-center gap-2.5">
                  <IconButton
                    size="session"
                    tone="outline"
                    onClick={() => cycle.show(0)}
                    aria-label={t('showStart')}
                    title={t('showStart')}
                  >
                    <SkipBackIcon weight="bold" />
                  </IconButton>
                  <IconButton
                    size="session"
                    tone="outline"
                    onClick={cycle.togglePlaying}
                    aria-label={t(cycle.playing ? 'pause' : 'play')}
                    title={t(cycle.playing ? 'pause' : 'play')}
                  >
                    {cycle.playing ? <PauseIcon /> : <PlayIcon />}
                  </IconButton>
                  <IconButton
                    size="session"
                    tone="outline"
                    onClick={() => cycle.show(1)}
                    aria-label={t('showFinish')}
                    title={t('showFinish')}
                  >
                    <SkipForwardIcon weight="bold" />
                  </IconButton>
                </div>

                <div className="flex flex-col gap-3.5 px-5">
                  <div className="grid grid-cols-2 gap-3">
                    {media.frames.map((source, index) => {
                      const frame = index as MediaFrame;
                      const selected = cycle.frame === frame;
                      return (
                        <button
                          key={source}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => cycle.show(frame)}
                          className="flex flex-col gap-1.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
                        >
                          <span
                            className={cn(
                              'relative block aspect-[3/2] w-full overflow-hidden rounded-sm bg-muted outline outline-2 outline-offset-2',
                              selected ? 'outline-ink' : 'outline-transparent',
                            )}
                          >
                            <Image
                              src={source}
                              alt=""
                              fill
                              unoptimized
                              sizes="(max-width: 672px) 50vw, 316px"
                              className="object-cover"
                            />
                          </span>
                          <span className="text-[0.8125rem] font-semibold">{frameLabel(frame)}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col gap-1 border-t border-border pt-3.5">
                    <span className="text-caption font-semibold">{t('equipment')}</span>
                    <p className="text-[0.9375rem] font-medium leading-[1.45]">
                      {t('equipmentDescription', { equipment: equipmentLabel })}
                    </p>
                  </div>

                  <p className="text-small leading-[1.45] text-muted-foreground">
                    {t('disclaimer')}{' '}
                    <a
                      href={media.source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-xs text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {t('source', { source: media.source.name, license: media.source.license })}
                      <ArrowSquareOutIcon className="size-3" />
                    </a>
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3 px-5 py-4">
                <p className="text-caption text-muted-foreground">{t('missing')}</p>
                <Button asChild variant="outline" size="sm">
                  <a href={commonsUrl} target="_blank" rel="noreferrer">
                    {t('searchCommons')}
                    <ArrowSquareOutIcon />
                  </a>
                </Button>
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
