-- CreateEnum
CREATE TYPE "DeloadTrigger" AS ENUM ('RECOMMENDED', 'MANUAL');

-- CreateTable
CREATE TABLE "DeloadPeriod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trigger" "DeloadTrigger" NOT NULL,
    "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "DeloadPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeloadPeriod_userId_startedAt_idx" ON "DeloadPeriod"("userId", "startedAt");

-- AddForeignKey
ALTER TABLE "DeloadPeriod" ADD CONSTRAINT "DeloadPeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
