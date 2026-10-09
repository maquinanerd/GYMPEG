import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/shared/theme-provider';
import { PwaUpdateManager } from '@/components/shared/pwa-update-manager';
import { NONCE_HEADER } from '@/lib/csp';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.metadata');

  return {
    title: 'GYM Peg',
    description: t('description'),
    applicationName: 'GYM Peg',
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: 'GYM Peg',
    },
    icons: {
      icon: [
        { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: '/icons/apple-touch-icon.png',
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  // Per-request CSP nonce from the middleware (lib/csp), for the inline theme
  // script of next-themes.
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;

  // Dark mode by default (locker rooms), togglable via next-themes (/settings page
  // or button in the header).
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider nonce={nonce}>
            <PwaUpdateManager />
            {children}
            <Toaster richColors position="top-center" />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
