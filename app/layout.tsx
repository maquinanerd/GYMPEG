import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import { headers } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/shared/theme-provider';
import { PwaUpdateManager } from '@/components/shared/pwa-update-manager';
import { NONCE_HEADER } from '@/lib/csp';
import './globals.css';

// The one typeface (Archivo, OFL), self-hosted by next/font so the CSP keeps
// font-src 'self'. Variable in weight and width: text at 100%, numbers widened
// with the stretch-* utilities; italic is reserved for what the AI writes.
const archivo = Archivo({
  subsets: ['latin', 'latin-ext'],
  axes: ['wdth'],
  style: ['normal', 'italic'],
  variable: '--font-archivo',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.metadata');

  return {
    title: 'GYM Peg',
    description: t('description'),
    applicationName: 'GYM Peg',
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: 'GYM Peg',
    },
    icons: {
      icon: [
        { url: '/icons/favicon.svg', type: 'image/svg+xml' },
        { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
        { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: { url: '/icons/apple-touch-icon.png', sizes: '180x180' },
    },
  };
}

export const viewport: Viewport = {
  // Light is the default theme: the browser chrome matches its background.
  themeColor: '#F9F9F9',
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

  // Light theme for everyone; dark is opt-in from Perfil > Tema (next-themes).
  return (
    <html lang={locale} className={archivo.variable} suppressHydrationWarning>
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
