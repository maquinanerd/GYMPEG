import { cn } from '@/lib/utils';

// The lime block: edge to edge (no radius, no side margin), #111 on top. It
// marks what matters now (today's workout, the rest, the finished workout)
// and appears at most once per screen. Inside it, secondary text is
// brand-strong (#354119) and hairlines are ink at 14%.
export function LimeBlock({
  as: Comp = 'section',
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' | 'header' }) {
  return (
    <Comp
      className={cn('flex flex-col gap-3.5 bg-primary p-5 text-primary-foreground', className)}
      {...props}
    />
  );
}
