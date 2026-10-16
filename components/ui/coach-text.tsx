import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// What the AI writes: Archivo italic under a small "Coach" label (12/600,
// brand). Numbers the app calculated never go in here. No sphere, no glow,
// no sparkle: the italic is the whole signal.
export function CoachText({
  children,
  label,
  size = 'md',
  className,
}: {
  children: React.ReactNode;
  // Overrides the default "Coach" label ("Comentário do coach").
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const t = useTranslations('coach');
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-small font-semibold text-brand">{label ?? t('label')}</span>
      <div
        className={cn(
          'font-medium italic text-pretty',
          size === 'md' ? 'text-body leading-[1.45]' : 'text-caption leading-[1.4]',
        )}
      >
        {children}
      </div>
    </div>
  );
}

// A change the coach proposes: the one white surface of its block. Before
// struck through → after, and "Revisar ajuste", which opens the existing
// preview. Nothing changes until the lifter reviews and confirms there.
export function ProposedChange({
  heading,
  title,
  before,
  after,
  note,
  action,
  className,
}: {
  // "Ajuste proposto · Treino A".
  heading: React.ReactNode;
  // Exercise name.
  title: React.ReactNode;
  before: React.ReactNode;
  after: React.ReactNode;
  // "Nada muda até você revisar e confirmar."
  note?: React.ReactNode;
  // The review button or link (never applies directly).
  action: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 rounded-md border border-border bg-card px-4 py-3.5 text-card-foreground',
        className,
      )}
    >
      <span className="text-[0.8125rem] font-semibold text-muted-foreground">{heading}</span>
      <div className="flex flex-col gap-0.5">
        <span className="text-body font-semibold">{title}</span>
        <span className="font-num text-caption font-semibold tabular-nums stretch-108">
          <span className="text-muted-foreground line-through">{before}</span>
          <span aria-hidden>{'  →  '}</span>
          <span className="sr-only"> → </span>
          {after}
        </span>
      </div>
      {note && <span className="text-[0.8125rem] font-medium text-muted-foreground">{note}</span>}
      {action}
    </div>
  );
}
