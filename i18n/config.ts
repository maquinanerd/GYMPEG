export const locales = ['pt-BR', 'en', 'fr', 'ru'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'pt-BR';
export const localeCookieName = 'gymcoach.locale';
export const localeCookieMaxAge = 60 * 60 * 24 * 365;

export function isLocale(value: string | null | undefined): value is Locale {
  return locales.includes(value as Locale);
}

// Maps a loosely formatted language tag ("pt", "pt_br", "PT-PT", "en-US") onto
// a supported locale: an exact match first (case and separator insensitive),
// then the first supported locale sharing the primary language subtag, so any
// Portuguese tag resolves to pt-BR. Returns null when nothing matches.
export function matchLocale(value: string | null | undefined): Locale | null {
  const normalized = value?.trim().replace(/_/g, '-').toLowerCase();
  if (!normalized) return null;

  const exact = locales.find((locale) => locale.toLowerCase() === normalized);
  if (exact) return exact;

  const language = normalized.split('-')[0];
  return locales.find((locale) => locale.toLowerCase().split('-')[0] === language) ?? null;
}

export function resolveLocale(value: string | null | undefined): Locale {
  return matchLocale(value) ?? defaultLocale;
}

export const localeLabels: Record<Locale, string> = {
  'pt-BR': 'Português (Brasil)',
  en: 'English',
  fr: 'Français',
  ru: 'Русский',
};
