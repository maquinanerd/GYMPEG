import type { AIOperation } from '@/lib/prisma-client';
import { db } from '@/lib/db';
import type { AuditAction } from '@/lib/admin';

// Read-only figures for the admin panel. Aggregates only: no training,
// body or health data of any one person leaves these functions.

const DAY_MS = 24 * 60 * 60 * 1000;

export interface OverviewStats {
  accounts: number;
  newAccounts7d: number;
  admins: number;
  blocked: number;
  // Accounts that started at least one workout in the last 7 days.
  activeLifters7d: number;
  workouts7d: number;
  workouts30d: number;
  aiCalls7d: number;
  aiFailures7d: number;
  // USD; null when no call had a price (AI_COST_PER_MTOKEN_* unset).
  aiCost7d: number | null;
}

export async function getOverviewStats(now: Date = new Date()): Promise<OverviewStats> {
  const since7 = new Date(now.getTime() - 7 * DAY_MS);
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const [accounts, newAccounts7d, admins, blocked, active, workouts7d, workouts30d, ai, aiFailures7d] =
    await Promise.all([
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: since7 } } }),
      db.user.count({ where: { role: 'ADMIN' } }),
      db.user.count({ where: { blockedAt: { not: null } } }),
      db.session.groupBy({ by: ['userId'], where: { startedAt: { gte: since7 } } }),
      db.session.count({ where: { finishedAt: { gte: since7 } } }),
      db.session.count({ where: { finishedAt: { gte: since30 } } }),
      db.aIUsage.aggregate({
        where: { createdAt: { gte: since7 } },
        _count: { _all: true },
        _sum: { estimatedCost: true },
      }),
      db.aIUsage.count({ where: { createdAt: { gte: since7 }, success: false } }),
    ]);
  return {
    accounts,
    newAccounts7d,
    admins,
    blocked,
    activeLifters7d: active.length,
    workouts7d,
    workouts30d,
    aiCalls7d: ai._count._all,
    aiFailures7d,
    aiCost7d: ai._sum.estimatedCost,
  };
}

export interface AiUsageRow {
  calls: number;
  failures: number;
  inputTokens: number;
  outputTokens: number;
  cost: number | null;
  avgLatencyMs: number;
}

export interface AiUsageSummary {
  days: number;
  total: AiUsageRow;
  byModel: (AiUsageRow & { provider: string; model: string })[];
  byOperation: (AiUsageRow & { operation: AIOperation })[];
}

type UsageGroup = {
  _count: { _all: number };
  _sum: { inputTokens: number | null; outputTokens: number | null; estimatedCost: number | null };
  _avg: { latencyMs: number | null };
};

function toRow(group: UsageGroup, failures: number): AiUsageRow {
  return {
    calls: group._count._all,
    failures,
    inputTokens: group._sum.inputTokens ?? 0,
    outputTokens: group._sum.outputTokens ?? 0,
    cost: group._sum.estimatedCost,
    avgLatencyMs: Math.round(group._avg.latencyMs ?? 0),
  };
}

const USAGE_AGGREGATES = {
  _count: { _all: true },
  _sum: { inputTokens: true, outputTokens: true, estimatedCost: true },
  _avg: { latencyMs: true },
} as const;

export async function getAiUsageSummary(
  days = 30,
  now: Date = new Date(),
): Promise<AiUsageSummary> {
  const where = { createdAt: { gte: new Date(now.getTime() - days * DAY_MS) } };
  const failed = { ...where, success: false };
  const [total, totalFailures, byModel, modelFailures, byOperation, operationFailures] =
    await Promise.all([
      db.aIUsage.aggregate({ where, ...USAGE_AGGREGATES }),
      db.aIUsage.count({ where: failed }),
      db.aIUsage.groupBy({ by: ['provider', 'model'], where, ...USAGE_AGGREGATES }),
      db.aIUsage.groupBy({ by: ['provider', 'model'], where: failed, _count: { _all: true } }),
      db.aIUsage.groupBy({ by: ['operation'], where, ...USAGE_AGGREGATES }),
      db.aIUsage.groupBy({ by: ['operation'], where: failed, _count: { _all: true } }),
    ]);
  const modelFail = new Map(
    modelFailures.map((row) => [`${row.provider}\u0000${row.model}`, row._count._all]),
  );
  const operationFail = new Map(operationFailures.map((row) => [row.operation, row._count._all]));
  return {
    days,
    total: toRow(total, totalFailures),
    byModel: byModel
      .map((row) => ({
        provider: row.provider,
        model: row.model,
        ...toRow(row, modelFail.get(`${row.provider}\u0000${row.model}`) ?? 0),
      }))
      .sort((a, b) => b.calls - a.calls),
    byOperation: byOperation
      .map((row) => ({ operation: row.operation, ...toRow(row, operationFail.get(row.operation) ?? 0) }))
      .sort((a, b) => b.calls - a.calls),
  };
}

export interface AuditRow {
  id: string;
  createdAt: string;
  action: AuditAction | string;
  entity: string;
  entityId: string;
  // E-mails of accounts that still exist; null once erased.
  actorEmail: string | null;
  targetEmail: string | null;
  oldValue: unknown;
  newValue: unknown;
}

export async function listAuditLog(limit = 100): Promise<AuditRow[]> {
  const rows = await db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  const userIds = new Set<string>();
  for (const row of rows) {
    if (row.actorUserId) userIds.add(row.actorUserId);
    if (row.entity === 'User') userIds.add(row.entityId);
  }
  const users = await db.user.findMany({
    where: { id: { in: [...userIds] } },
    select: { id: true, email: true },
  });
  const emails = new Map(users.map((user) => [user.id, user.email]));
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    actorEmail: row.actorUserId ? (emails.get(row.actorUserId) ?? null) : null,
    targetEmail: row.entity === 'User' ? (emails.get(row.entityId) ?? null) : null,
    oldValue: row.oldValue,
    newValue: row.newValue,
  }));
}
