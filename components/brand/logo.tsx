import { cn } from '@/lib/utils';

// The GYM Peg symbol ("Ciclo", option 1c): one stroke rising in steps, the
// same path as public/brand/mark.svg. Drawn inline so it takes currentColor.
const MARK_PATH = 'M8 49 L20 35 L26 41 L38 25 L44 31 L56 15';

export function BrandMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={cn('size-6', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path
        d={MARK_PATH}
        stroke="currentColor"
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// "GYM" Archivo 600 + "Peg" Archivo 400. The product name is not translated.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('leading-none tracking-tight', className)}>
      <span className="font-semibold">GYM</span> <span className="font-normal">Peg</span>
    </span>
  );
}

// Lockup: the symbol on a lime tile (lime is only ever a fill, with #111 on
// top) followed by the wordmark. `size` scales the whole lockup.
export function Logo({
  size = 'md',
  withWordmark = true,
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  withWordmark?: boolean;
  className?: string;
}) {
  const tile = { sm: 'size-8 rounded-[10px]', md: 'size-10 rounded-[12px]', lg: 'size-14 rounded-sm' }[
    size
  ];
  const mark = { sm: 'size-5', md: 'size-6', lg: 'size-9' }[size];
  const text = { sm: 'text-subtitle', md: 'text-heading', lg: 'text-display' }[size];
  return (
    <span className={cn('inline-flex items-center gap-2.5 text-foreground', className)}>
      <span
        className={cn(
          'flex shrink-0 items-center justify-center bg-primary text-primary-foreground',
          tile,
        )}
      >
        <BrandMark className={mark} />
      </span>
      {withWordmark ? <Wordmark className={text} /> : <span className="sr-only">GYM Peg</span>}
    </span>
  );
}
