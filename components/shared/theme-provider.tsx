'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

// Storage key of the theme choice. A new key (the GymCoach one held "dark" or
// "system" for most people) so everyone starts on the light theme once.
export const THEME_STORAGE_KEY = 'gympeg-theme';

// next-themes wrapper (client-only). Light is the theme everyone sees; dark is
// an opt-in from Perfil > Tema. No "system" option: the phone's dark mode does
// not switch the app.
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey={THEME_STORAGE_KEY}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
