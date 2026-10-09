-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "cycleAnchor" TIMESTAMP(3),
ADD COLUMN     "cycleDeloadWeek" INTEGER,
ADD COLUMN     "cycleWeeks" INTEGER;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "cycleWeek" INTEGER;
