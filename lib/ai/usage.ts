// AI calls go through runAiCompletion (G4, addendum 02 §1, §33-35): one
// provider call (the provider layer already falls back from the primary to
// the configured fallback), timed and logged in AIUsage with tokens, latency,
// the estimated cost and whether it worked. No prompt or answer text is kept.

import type { AIOperation } from '@/lib/prisma-client';
import { db } from '@/lib/db';
import { getLlmProvider, type LlmCompletionRequest, type LlmCompletionResult } from '@/lib/llm';
import { log } from '@/lib/log';

type Env = Record<string, string | undefined>;

// USD per million tokens from AI_COST_PER_MTOKEN_INPUT / _OUTPUT; null when
// the instance has not set its price.
export function estimateAiCost(
  usage: { inputTokens: number; outputTokens: number } | undefined,
  env: Env = process.env,
): number | null {
  const input = Number(env.AI_COST_PER_MTOKEN_INPUT);
  const output = Number(env.AI_COST_PER_MTOKEN_OUTPUT);
  if (
    !usage ||
    !Number.isFinite(input) ||
    !Number.isFinite(output) ||
    !env.AI_COST_PER_MTOKEN_INPUT
  ) {
    return null;
  }
  return Math.round(((usage.inputTokens * input + usage.outputTokens * output) / 1e6) * 1e6) / 1e6;
}

export async function runAiCompletion(
  userId: string,
  operation: AIOperation,
  request: LlmCompletionRequest,
  promptVersion?: string,
): Promise<LlmCompletionResult> {
  const provider = getLlmProvider();
  const started = Date.now();
  let result: LlmCompletionResult | null = null;
  try {
    result = await provider.complete(request);
    return result;
  } finally {
    const latencyMs = Date.now() - started;
    await db.aIUsage
      .create({
        data: {
          userId,
          provider: provider.id,
          model: result?.modelUsed ?? provider.model,
          operation,
          inputTokens: result?.usage?.inputTokens ?? null,
          outputTokens: result?.usage?.outputTokens ?? null,
          latencyMs,
          estimatedCost: estimateAiCost(result?.usage),
          success: result != null,
          promptVersion: promptVersion ?? null,
        },
      })
      .catch((err: unknown) => log.error('ai.usage.record_failed', { err }));
  }
}

// The idempotency cache (§34): the stored result for this key, if it is
// recent enough.
const RESULT_TTL_MS = 10 * 60 * 1000;

export async function cachedAiResult<T>(
  userId: string,
  idempotencyKey: string | undefined,
): Promise<T | null> {
  if (!idempotencyKey) return null;
  const row = await db.aiResultCache.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey } },
  });
  if (!row || Date.now() - row.createdAt.getTime() > RESULT_TTL_MS) return null;
  return row.result as T;
}

export async function storeAiResult(
  userId: string,
  idempotencyKey: string | undefined,
  operation: AIOperation,
  result: unknown,
): Promise<void> {
  if (!idempotencyKey) return;
  await db.aiResultCache.upsert({
    where: { userId_idempotencyKey: { userId, idempotencyKey } },
    create: { userId, idempotencyKey, operation, result: result as object },
    update: { operation, result: result as object, createdAt: new Date() },
  });
  // Old entries are swept now and then.
  if (Math.random() < 0.05) {
    void db.aiResultCache
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RESULT_TTL_MS) } } })
      .catch(() => undefined);
  }
}
