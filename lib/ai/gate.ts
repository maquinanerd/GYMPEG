// The gate every AI route goes through before any of the lifter's data
// reaches a provider (G4, addendum 02 §32, §36): the feature is switched on
// for this instance and the lifter accepted the current consent notice.

import { db } from '@/lib/db';
import { ApiError } from '@/lib/api';
import { hasAiConsent, isAiFeatureEnabled, type AiFeature } from '@/lib/ai/features';

// Error texts the client recognises to show the consent card or a notice.
export const AI_CONSENT_REQUIRED = 'AI_CONSENT_REQUIRED';
export const AI_FEATURE_DISABLED = 'AI_FEATURE_DISABLED';

export async function requireAiAccess(userId: string, feature: AiFeature): Promise<void> {
  if (!isAiFeatureEnabled(feature)) {
    throw new ApiError(403, AI_FEATURE_DISABLED);
  }
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { aiConsentAt: true, aiConsentVersion: true },
  });
  if (!hasAiConsent(user)) {
    throw new ApiError(403, AI_CONSENT_REQUIRED);
  }
}
