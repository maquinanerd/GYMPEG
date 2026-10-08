import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import {
  defaultLocale,
  isLocale,
  localeLabels,
  locales,
  matchLocale,
  resolveLocale,
  type Locale,
} from '@/i18n/config';
import englishMessages from '@/messages/en';
import frenchMessages from '@/messages/fr';
import brazilianPortugueseMessages from '@/messages/pt-BR';
import russianMessages from '@/messages/ru';

// Typed against Locale so registering a new locale without a catalog fails to
// compile, and every check below runs for it automatically.
const catalogs = {
  'pt-BR': brazilianPortugueseMessages,
  en: englishMessages,
  fr: frenchMessages,
  ru: russianMessages,
} satisfies Record<Locale, typeof englishMessages>;

function messageEntries(value: unknown, prefix = ''): [string, string][] {
  if (typeof value === 'string') return [[prefix, value]];
  if (!value || typeof value !== 'object') return [];

  return Object.entries(value).flatMap(([key, child]) =>
    messageEntries(child, prefix ? `${prefix}.${key}` : key),
  );
}

function messageKeys(value: unknown): string[] {
  return messageEntries(value).map(([key]) => key);
}

// Minimal ICU walker: collects the argument names a message interpolates
// ({name}, {count, plural, ...}, {reasons, select, ...}), descending into
// plural/select branches. Enough to catch a renamed or dropped placeholder.
function icuArguments(message: string): string[] {
  const found = new Set<string>();
  let index = 0;

  function readMessage(): void {
    while (index < message.length) {
      const char = message[index];
      if (char === '}') return;
      if (char === '{') {
        index += 1;
        readArgument();
      } else {
        index += 1;
      }
    }
  }

  function readArgument(): void {
    const name = /^\s*([A-Za-z0-9_]+)\s*/.exec(message.slice(index));
    if (!name) throw new Error(`Malformed ICU argument in: ${message}`);
    found.add(name[1]!);
    index += name[0].length;
    if (message[index] === '}') {
      index += 1;
      return;
    }
    if (message[index] !== ',') throw new Error(`Malformed ICU argument in: ${message}`);
    index += 1;
    const type = /^\s*([a-z]+)\s*/.exec(message.slice(index));
    if (!type) throw new Error(`Missing ICU argument type in: ${message}`);
    index += type[0].length;

    if (!['plural', 'select', 'selectordinal'].includes(type[1]!)) {
      // number/date/time with an optional style: skip to the closing brace.
      const close = message.indexOf('}', index);
      if (close < 0) throw new Error(`Unclosed ICU argument in: ${message}`);
      index = close + 1;
      return;
    }

    if (message[index] !== ',') throw new Error(`Missing ICU options in: ${message}`);
    index += 1;
    while (index < message.length) {
      const selector = /^\s*(offset:\d+\s+)?(=?[A-Za-z0-9_]+)\s*/.exec(message.slice(index));
      if (!selector) break;
      index += selector[0].length;
      if (message[index] !== '{') throw new Error(`Missing ICU branch in: ${message}`);
      index += 1;
      readMessage();
      if (message[index] !== '}') throw new Error(`Unclosed ICU branch in: ${message}`);
      index += 1;
    }
    const rest = /^\s*\}/.exec(message.slice(index));
    if (!rest) throw new Error(`Unclosed ICU argument in: ${message}`);
    index += rest[0].length;
  }

  readMessage();
  if (index < message.length) throw new Error(`Unbalanced braces in: ${message}`);
  return [...found].sort();
}

describe('i18n configuration', () => {
  it('recognizes only supported locales', () => {
    expect(locales).toEqual(['pt-BR', 'en', 'fr', 'ru']);
    expect(isLocale('pt-BR')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('fr')).toBe(true);
    expect(isLocale('ru')).toBe(true);
    expect(isLocale('pt')).toBe(false);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it('defaults to Brazilian Portuguese', () => {
    expect(defaultLocale).toBe('pt-BR');
    expect(localeLabels['pt-BR']).toBe('Português (Brasil)');
    expect(resolveLocale(undefined)).toBe('pt-BR');
    expect(resolveLocale('')).toBe('pt-BR');
    expect(resolveLocale('de')).toBe('pt-BR');
  });

  it('matches loosely formatted language tags onto supported locales', () => {
    expect(matchLocale('pt-BR')).toBe('pt-BR');
    expect(matchLocale('pt')).toBe('pt-BR');
    expect(matchLocale('pt_br')).toBe('pt-BR');
    expect(matchLocale(' PT-PT ')).toBe('pt-BR');
    expect(matchLocale('en-US')).toBe('en');
    expect(matchLocale('fr-CA')).toBe('fr');
    expect(matchLocale('ru')).toBe('ru');
    expect(matchLocale('de-DE')).toBeNull();
    expect(matchLocale(null)).toBeNull();
    expect(resolveLocale('en')).toBe('en');
  });

  it('keeps every locale dictionary structurally complete', () => {
    const english = messageKeys(englishMessages).sort();
    for (const locale of locales) {
      expect(messageKeys(catalogs[locale]).sort(), locale).toEqual(english);
    }
  });

  it('keeps the ICU arguments of every message identical to English', () => {
    const english = new Map(messageEntries(englishMessages));
    for (const locale of locales) {
      for (const [key, message] of messageEntries(catalogs[locale])) {
        expect(icuArguments(message), `${locale}: ${key}`).toEqual(
          icuArguments(english.get(key) ?? ''),
        );
      }
    }
  });

  it('formats every message in every locale without errors', () => {
    for (const locale of locales) {
      const errors: string[] = [];
      const t = createTranslator({
        locale,
        messages: catalogs[locale],
        onError: (error) => errors.push(error.message),
      }) as unknown as (key: string, values?: Record<string, string | number>) => string;
      for (const [key, message] of messageEntries(catalogs[locale])) {
        const values = Object.fromEntries(icuArguments(message).map((name) => [name, 2]));
        t(key, values);
      }
      expect(errors, locale).toEqual([]);
    }
  });

  it('uses Russian plural categories', () => {
    const t = createTranslator({ locale: 'ru', messages: russianMessages });

    expect(t('common.counts.sets', { count: 1 })).toBe('1 подход');
    expect(t('common.counts.sets', { count: 3 })).toBe('3 подхода');
    expect(t('common.counts.sets', { count: 12 })).toBe('12 подходов');
    expect(t('navigation.settings')).toBe('Настройки');
    expect(t('progress.measurements.sites.armLeft')).toBe('Плечо (левое)');
    expect(t('progress.dashboard.frequency', { count: 3 })).toBe('3 раза/нед.');
  });

  it('uses French plural categories', () => {
    const t = createTranslator({ locale: 'fr', messages: frenchMessages });

    expect(t('common.counts.sets', { count: 1 })).toBe('1 série');
    expect(t('common.counts.sets', { count: 3 })).toBe('3 séries');
    expect(t('navigation.settings')).toBe('Réglages');
    expect(t('progress.measurements.sites.armLeft')).toBe('Bras (gauche)');
    expect(t('progress.dashboard.frequency', { count: 3 })).toBe('3x/semaine');
  });

  it('uses Brazilian Portuguese wording and plural categories', () => {
    const t = createTranslator({ locale: 'pt-BR', messages: brazilianPortugueseMessages });

    expect(t('common.counts.sets', { count: 0 })).toBe('Nenhuma série');
    expect(t('common.counts.sets', { count: 1 })).toBe('1 série');
    expect(t('common.counts.sets', { count: 3 })).toBe('3 séries');
    expect(t('common.counts.exercises', { count: 2 })).toBe('2 exercícios');
    expect(t('navigation.settings')).toBe('Configurações');
    expect(t('common.language.portuguese')).toBe('Português (Brasil)');
    expect(t('progress.measurements.sites.armLeft')).toBe('Braço (esquerdo)');
    expect(t('progress.dashboard.frequency', { count: 3 })).toBe('3x/semana');
    expect(t('exercises.muscleGroups.hamstrings')).toBe('Posteriores de coxa');
    expect(t('session.rest.title')).toBe('Descanso');
    expect(t('history.calendar.workoutCount', { count: 2 })).toBe('2 treinos');
    expect(
      t('programs.exercise.prescription', { sets: 3, reps: '8-12', rir: 2, seconds: 90 }),
    ).toBe('3 séries × 8-12 reps · RIR 2 · descanso 90s');
  });
});
