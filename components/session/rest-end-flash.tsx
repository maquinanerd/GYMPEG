'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// How long the flash lasts: one 300ms lime flash (design v2).
export const REST_END_FLASH_MS = 300;

interface Props {
  // Bumped by the caller each time a rest runs out with the flash preference
  // on (issue #393). Zero means no flash yet.
  count: number;
}

// Full-screen, click-through lime flash at the end of a rest, for a gym too
// loud for the beep. It mounts opaque and fades out over 300ms; with reduced
// motion there is no fade, the fixed colour simply shows for those 300ms (the
// vibration carries the rest).
export function RestEndFlash({ count }: Props) {
  const [visibleFor, setVisibleFor] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (count === 0) return;
    setVisibleFor(count);
    setFading(false);
    // Next frame: start the fade from the opaque first paint.
    const frame = requestAnimationFrame(() => setFading(true));
    const id = setTimeout(() => setVisibleFor(0), REST_END_FLASH_MS);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(id);
    };
  }, [count]);

  if (visibleFor === 0) return null;
  return (
    <div
      key={visibleFor}
      aria-hidden="true"
      data-testid="rest-end-flash"
      className={cn(
        'pointer-events-none fixed inset-0 z-[60] bg-primary transition-opacity duration-300 ease-out-quart motion-reduce:opacity-100 motion-reduce:transition-none',
        fading ? 'opacity-0' : 'opacity-100',
      )}
    />
  );
}
