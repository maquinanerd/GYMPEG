import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The design type scale (tailwind.config.ts fontSize). tailwind-merge must know
// these are font sizes: as unknown "text-*" classes it would read them as
// colors, and `text-subtitle` would silently drop `text-primary-foreground`.
export const FONT_SIZES = [
  'timer',
  'display',
  'number',
  'title',
  'heading',
  'subtitle',
  'body',
  'caption',
  'small',
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...FONT_SIZES] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
