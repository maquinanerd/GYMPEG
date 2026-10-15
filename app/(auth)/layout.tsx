import { Logo } from '@/components/brand/logo';
import { LanguageSelector } from '@/components/shared/language-selector';

// Layout for authentication routes: no app navigation. One left-aligned
// column on the page background (max-w-md on desktop) with the logo on top.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10">
        <header className="flex items-center justify-between gap-3 pb-10 pt-5">
          <Logo />
          <LanguageSelector showLabel />
        </header>
        {children}
      </div>
    </div>
  );
}
