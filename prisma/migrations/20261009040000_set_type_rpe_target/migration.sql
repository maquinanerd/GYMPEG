-- CreateEnum
CREATE TYPE "SetType" AS ENUM ('WARMUP', 'WORKING', 'DROP', 'AMRAP', 'FAILURE', 'BACKOFF', 'OTHER');

-- AlterTable
ALTER TABLE "Set" ADD COLUMN     "bodyweightKgSnapshot" DOUBLE PRECISION,
ADD COLUMN     "rpe" DOUBLE PRECISION,
ADD COLUMN     "targetRepsMax" INTEGER,
ADD COLUMN     "targetRepsMin" INTEGER,
ADD COLUMN     "targetRir" INTEGER,
ADD COLUMN     "type" "SetType" NOT NULL DEFAULT 'WORKING';

-- Backfill the kind of set from the legacy flags (a set flagged both ways is
-- treated as a warm-up, which is how every reader already excluded it).
UPDATE "Set" SET "type" = 'WARMUP' WHERE "isWarmup" = true;
UPDATE "Set" SET "type" = 'DROP' WHERE "isDropSet" = true AND "isWarmup" = false;
