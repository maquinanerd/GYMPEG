-- CreateEnum
CREATE TYPE "ProgramRevisionSource" AS ENUM ('CREATED', 'USER', 'TEMPLATE', 'AI_GENERATED', 'COACH', 'MCP', 'IMPORT', 'RESTORE', 'SYSTEM');

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "programRevisionId" TEXT;

-- CreateTable
CREATE TABLE "ProgramRevision" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "source" "ProgramRevisionSource" NOT NULL,
    "summary" TEXT,
    "restoredFromVersion" INTEGER,
    "snapshot" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProgramRevision_programId_version_key" ON "ProgramRevision"("programId", "version");

-- CreateIndex
CREATE INDEX "Session_programRevisionId_idx" ON "Session"("programRevisionId");

-- AddForeignKey
ALTER TABLE "ProgramRevision" ADD CONSTRAINT "ProgramRevision_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_programRevisionId_fkey" FOREIGN KEY ("programRevisionId") REFERENCES "ProgramRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
