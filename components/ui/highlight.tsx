import { Num, type NumStretch } from '@/components/ui/num';
import { cn } from '@/lib/utils';

// Record highlighter: the yellow marker behind the number that beat a record.
// Only ever behind a number (never an icon, a card or a button). `children`
// is the formatted value ("94 kg", "× 6").
export function Highlight({
  children,
  stretch = 118,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { stretch?: NumStretch }) {
  return (
    <Num
      stretch={stretch}
      className={cn('inline-block rounded-xs bg-pr px-1.5 py-0.5 text-pr-foreground', className)}
      {...props}
    >
      {children}
    </Num>
  );
}
