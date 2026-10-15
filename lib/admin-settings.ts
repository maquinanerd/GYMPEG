import { z } from 'zod';
import { AI_FEATURES } from '@/lib/ai/features';

// What an admin may change in /admin, keyed by the environment variable each
// entry overrides (lib/runtime-env). Shared by the API (validation) and the
// panel (labels and inputs), so it stays free of server-only imports.

// Providers offered in the panel. codex-lb also needs a base URL and stays
// configured in the environment only.
export const PANEL_PROVIDER_IDS = ['gemini', 'deepseek', 'openrouter', 'anthropic', 'demo'] as const;
export type PanelProviderId = (typeof PANEL_PROVIDER_IDS)[number];

// The providers that take an API key, with the variable that holds it.
export const PROVIDER_KEYS = {
  gemini: { apiKey: 'GEMINI_API_KEY', model: 'GEMINI_MODEL' },
  deepseek: { apiKey: 'DEEPSEEK_API_KEY', model: 'DEEPSEEK_MODEL' },
  openrouter: { apiKey: 'OPENROUTER_API_KEY', model: 'OPENROUTER_MODEL' },
  anthropic: { apiKey: 'ANTHROPIC_API_KEY', model: 'ANTHROPIC_MODEL' },
} as const satisfies Record<Exclude<PanelProviderId, 'demo'>, { apiKey: string; model: string }>;

export const SETTING_KEYS = [
  'AI_PROVIDER',
  'AI_FALLBACK_PROVIDER',
  'GEMINI_MODEL',
  'DEEPSEEK_MODEL',
  'OPENROUTER_MODEL',
  'ANTHROPIC_MODEL',
  'AI_FEATURES_DISABLED',
  'AI_COST_PER_MTOKEN_INPUT',
  'AI_COST_PER_MTOKEN_OUTPUT',
  'EMAIL_PROVIDER',
  'EMAIL_FROM',
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

export const SECRET_KEYS = [
  'GEMINI_API_KEY',
  'DEEPSEEK_API_KEY',
  'OPENROUTER_API_KEY',
  'ANTHROPIC_API_KEY',
  'RESEND_API_KEY',
] as const;
export type SecretKey = (typeof SECRET_KEYS)[number];

export function isSettingKey(key: string): key is SettingKey {
  return (SETTING_KEYS as readonly string[]).includes(key);
}

export function isSecretKey(key: string): key is SecretKey {
  return (SECRET_KEYS as readonly string[]).includes(key);
}

// 'off' switches e-mail off even when the environment configures it.
export const EMAIL_PROVIDER_VALUES = ['resend', 'off'] as const;

const provider = z.enum(PANEL_PROVIDER_IDS);
const model = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9._:/-]+$/, 'Invalid model id');
const price = z
  .string()
  .trim()
  .regex(/^\d{1,6}(\.\d{1,6})?$/, 'Invalid price');

const SETTING_VALUES: Record<SettingKey, z.ZodType<string>> = {
  AI_PROVIDER: provider,
  // Empty: no fallback, even if the environment names one.
  AI_FALLBACK_PROVIDER: z.union([provider, z.literal('')]),
  GEMINI_MODEL: model,
  DEEPSEEK_MODEL: model,
  OPENROUTER_MODEL: model,
  ANTHROPIC_MODEL: model,
  // Comma-separated features to switch off; empty keeps every feature on.
  AI_FEATURES_DISABLED: z
    .string()
    .trim()
    .max(200)
    .refine(
      (value) =>
        value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
          .every((item) => (AI_FEATURES as readonly string[]).includes(item)),
      'Unknown AI feature',
    ),
  AI_COST_PER_MTOKEN_INPUT: price,
  AI_COST_PER_MTOKEN_OUTPUT: price,
  EMAIL_PROVIDER: z.enum(EMAIL_PROVIDER_VALUES),
  // "GYM Peg <no-reply@example.com>" or a bare address.
  EMAIL_FROM: z
    .string()
    .trim()
    .max(200)
    .regex(/^([^<>@\s][^<>@]*\s)?<?[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>?$/, 'Invalid sender'),
};

// null clears the panel value, so the environment variable applies again.
export const settingsUpdateSchema = z
  .object({ settings: z.record(z.enum(SETTING_KEYS), z.string().nullable()) })
  .superRefine((input, ctx) => {
    for (const [key, value] of Object.entries(input.settings)) {
      if (value === null) continue;
      const parsed = SETTING_VALUES[key as SettingKey].safeParse(value);
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['settings', key],
          message: `${key}: ${parsed.error.issues[0]?.message ?? 'invalid'}`,
        });
      }
    }
  })
  .transform((input) => {
    const settings: Partial<Record<SettingKey, string | null>> = {};
    for (const [key, value] of Object.entries(input.settings)) {
      settings[key as SettingKey] = value === null ? null : value.trim();
    }
    return settings;
  });

// API keys: printable characters without spaces.
export const secretUpdateSchema = z.object({
  key: z.enum(SECRET_KEYS),
  value: z
    .string()
    .trim()
    .min(8, 'Key too short')
    .max(500)
    .regex(/^[\x21-\x7E]+$/, 'Invalid key')
    .nullable(),
});
