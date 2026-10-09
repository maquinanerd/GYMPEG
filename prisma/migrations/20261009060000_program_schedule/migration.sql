-- CreateEnum
CREATE TYPE "ProgramSchedule" AS ENUM ('ROTATION', 'FIXED_DAYS');

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "scheduleMode" "ProgramSchedule" NOT NULL DEFAULT 'ROTATION';

-- Backfill: a program whose every workout already has a weekday was planned
-- by days; keep it that way. Anything else continues as a rotation.
UPDATE "Program" p
SET "scheduleMode" = 'FIXED_DAYS'
WHERE EXISTS (SELECT 1 FROM "Workout" w WHERE w."programId" = p."id")
  AND NOT EXISTS (
    SELECT 1 FROM "Workout" w WHERE w."programId" = p."id" AND w."dayOfWeek" IS NULL
  );
