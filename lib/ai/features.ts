// AI feature flags (G4, addendum 02 §36) and the consent the lifter gives
// before any of their training or health data goes to an AI provider.

export const AI_FEATURES = [
  'ai.workout_generation',
  'ai.workout_adjustment',
  'ai.weekly_review',
  'ai.chat',
] as const;

export type AiFeature = (typeof AI_FEATURES)[number];

// Every feature is on unless listed in AI_FEATURES_DISABLED (comma separated),
// so an instance can switch one off without a deploy of code.
export function isAiFeatureEnabled(
  feature: AiFeature,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const disabled = (env.AI_FEATURES_DISABLED ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return !disabled.includes(feature);
}

// Version of the notice the lifter accepts. A new version (different data
// sent, another provider) asks for consent again.
export const AI_CONSENT_VERSION = '2026-10-09';

export function hasAiConsent(
  user: {
    aiConsentAt: Date | null;
    aiConsentVersion: string | null;
  } | null,
): boolean {
  return user?.aiConsentAt != null && user.aiConsentVersion === AI_CONSENT_VERSION;
}
