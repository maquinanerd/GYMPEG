-- CreateEnum
CREATE TYPE "AIOperation" AS ENUM ('GENERATE_PROGRAM', 'ADJUST_PROGRAM', 'WEEKLY_REVIEW', 'EXPLAIN_RECOMMENDATION', 'CHAT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aiConsentAt" TIMESTAMP(3),
ADD COLUMN     "aiConsentVersion" TEXT;

-- CreateTable
CREATE TABLE "AIUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "operation" "AIOperation" NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "latencyMs" INTEGER NOT NULL,
    "estimatedCost" DOUBLE PRECISION,
    "success" BOOLEAN NOT NULL,
    "promptVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiResultCache" (
    "userId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "operation" "AIOperation" NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiResultCache_pkey" PRIMARY KEY ("userId","idempotencyKey")
);

-- CreateIndex
CREATE INDEX "AIUsage_userId_createdAt_idx" ON "AIUsage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AIUsage_operation_createdAt_idx" ON "AIUsage"("operation", "createdAt");

-- CreateIndex
CREATE INDEX "AiResultCache_createdAt_idx" ON "AiResultCache"("createdAt");

-- AddForeignKey
ALTER TABLE "AIUsage" ADD CONSTRAINT "AIUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiResultCache" ADD CONSTRAINT "AiResultCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
