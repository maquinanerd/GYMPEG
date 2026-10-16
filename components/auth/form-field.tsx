import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// A link inside a sentence ("No account yet? Create one"): ink, underlined.
export const inlineLinkClass =
  'rounded-xs font-semibold text-foreground underline underline-offset-4 hover:decoration-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

// Id of a field's error line, for the input's aria-describedby.
export function fieldErrorId(id: string): string {
  return `${id}-error`;
}

// A form field of the account screens: label above the 48px input, the error
// under it in destructive text. The input itself is passed as children so it
// keeps its own register() wiring; point its aria-describedby at
// fieldErrorId(id) while there is an error.
export function FormField({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string;
  label: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id} className="text-caption font-semibold leading-tight">
        {label}
      </Label>
      {children}
      {error && (
        <p id={fieldErrorId(id)} className="text-caption text-destructive-text">
          {error}
        </p>
      )}
    </div>
  );
}

// Title block of an account screen: left aligned on the page background.
export function AuthHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-title">{title}</h1>
      {description && <p className="text-body text-muted-foreground">{description}</p>}
    </div>
  );
}

// Inline message under a form (server refusal, expired link): text, no box.
export function FormMessage({
  tone = 'error',
  role = 'alert',
  className,
  children,
}: {
  tone?: 'error' | 'note';
  role?: 'alert' | 'status';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      role={role}
      className={cn(
        'text-caption',
        tone === 'error'
          ? 'text-destructive-text'
          : 'rounded-sm bg-muted px-3.5 py-3 leading-[1.4] text-foreground',
        className,
      )}
    >
      {children}
    </p>
  );
}
