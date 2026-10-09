-- AlterEnum
ALTER TYPE "TrainingGoal" ADD VALUE 'MAINTENANCE';
ALTER TYPE "TrainingGoal" ADD VALUE 'RETURN_TO_TRAINING';

-- CreateEnum
CREATE TYPE "TrainingExperience" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "ExercisePreferenceKind" AS ENUM ('PREFER', 'AVOID');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "experience" "TrainingExperience",
ADD COLUMN     "onboardedAt" TIMESTAMP(3),
ADD COLUMN     "preferredTrainingTime" TEXT,
ADD COLUMN     "priorityMuscles" "MuscleGroup"[] DEFAULT ARRAY[]::"MuscleGroup"[],
ADD COLUMN     "sessionMinutes" INTEGER,
ADD COLUMN     "trainingDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "Gym" ADD COLUMN     "availableEquipment" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "ExercisePreference" (
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "kind" "ExercisePreferenceKind" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExercisePreference_pkey" PRIMARY KEY ("userId","exerciseId")
);

-- CreateIndex
CREATE INDEX "ExercisePreference_exerciseId_idx" ON "ExercisePreference"("exerciseId");

-- AddForeignKey
ALTER TABLE "ExercisePreference" ADD CONSTRAINT "ExercisePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExercisePreference" ADD CONSTRAINT "ExercisePreference_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Accounts that existed before onboarding are treated as already set up, so
-- only new accounts see the onboarding prompt.
UPDATE "User" SET "onboardedAt" = "createdAt";
