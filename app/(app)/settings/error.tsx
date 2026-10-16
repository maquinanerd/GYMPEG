'use client';

import { ErrorState } from '@/components/ui/screen-state';

// Perfil or one of its pages did not load: say so and retry. Training keeps
// working on the device meanwhile.
export default function SettingsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 pt-4">
      <ErrorState onRetry={reset} />
    </main>
  );
}
