-- CreateEnum
CREATE TYPE "RecommendationAction" AS ENUM ('INCREASE', 'HOLD', 'DECREASE', 'DELOAD', 'INSUFFICIENT_DATA');

-- CreateTable
CREATE TABLE "TrainingRecommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "programExerciseId" TEXT,
    "exerciseId" TEXT NOT NULL,
    "action" "RecommendationAction" NOT NULL,
    "valueKg" DOUBLE PRECISION,
    "reason" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "guidelineVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingRecommendation_sessionId_idx" ON "TrainingRecommendation"("sessionId");

-- CreateIndex
CREATE INDEX "TrainingRecommendation_userId_exerciseId_createdAt_idx" ON "TrainingRecommendation"("userId", "exerciseId", "createdAt");

-- AddForeignKey
ALTER TABLE "TrainingRecommendation" ADD CONSTRAINT "TrainingRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecommendation" ADD CONSTRAINT "TrainingRecommendation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecommendation" ADD CONSTRAINT "TrainingRecommendation_programExerciseId_fkey" FOREIGN KEY ("programExerciseId") REFERENCES "ProgramExercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
