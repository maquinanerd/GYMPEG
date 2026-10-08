-- AlterTable
ALTER TABLE "Set" ADD COLUMN     "clientMutationId" TEXT,
ADD COLUMN     "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "Set_sessionId_clientMutationId_key" ON "Set"("sessionId", "clientMutationId");


-- Existing sets were received when they were performed (online logging).
UPDATE "Set" SET "receivedAt" = "completedAt";
