-- CreateTable
CREATE TABLE "SetTombstone" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "clientMutationId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SetTombstone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SetTombstone_sessionId_clientMutationId_key" ON "SetTombstone"("sessionId", "clientMutationId");

-- AddForeignKey
ALTER TABLE "SetTombstone" ADD CONSTRAINT "SetTombstone_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
